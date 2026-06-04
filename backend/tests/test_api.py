from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Encounter, EncounterTurnLog
import main


client = TestClient(main.app)


class FakeConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class FakeEngine:
    def connect(self):
        return FakeConnection()


def test_health_returns_ok_when_database_connects(monkeypatch):
    monkeypatch.setattr(main, "engine", FakeEngine())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_get_characters_contains_core_characters():
    response = client.get("/characters")

    assert response.status_code == 200
    names = {character["name"] for character in response.json()}
    assert {"Ayane", "Johan"}.issubset(names)


def test_get_character_by_slug():
    response = client.get("/characters/ayane")

    assert response.status_code == 200
    assert response.json()["name"] == "Ayane"


def test_get_unknown_character_returns_404():
    response = client.get("/characters/unknown")

    assert response.status_code == 404


def test_roll_returns_total_with_modifier():
    response = client.post("/roll?modifier=2")

    assert response.status_code == 200
    payload = response.json()
    assert {"roll", "modifier", "total", "nat20", "nat1"}.issubset(payload)
    assert payload["modifier"] == 2
    assert payload["total"] == payload["roll"] + 2


def test_combat_resolve_returns_attack_damage_and_hp():
    payload = {
        "character_id": "ayane",
        "attack_modifier": 5,
        "target_ac": 14,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
        "target_current_hp": 20,
    }

    response = client.post("/combat/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert {"attack", "damage", "hp"}.issubset(body)
    assert body["hp"]["previous_hp"] == 20
    assert body["hp"]["remaining_hp"] <= 20


def test_combat_resolve_rejects_invalid_target_hp():
    payload = {
        "character_id": "ayane",
        "attack_modifier": 5,
        "target_ac": 14,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
        "target_current_hp": -1,
    }

    response = client.post("/combat/resolve", json=payload)

    assert response.status_code == 422


def test_combat_initiative_returns_order():
    payload = {
        "participants": [
            {"participant_id": "ayane", "dexterity_modifier": 2},
            {"participant_id": "johan", "dexterity_modifier": 0},
        ]
    }

    response = client.post("/combat/initiative", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert "order" in body
    assert len(body["order"]) == 2
    assert {"participant_id", "roll", "modifier", "total", "nat20", "nat1"}.issubset(body["order"][0])


def test_combat_initiative_rejects_empty_participants():
    response = client.post("/combat/initiative", json={"participants": []})

    assert response.status_code == 422


def test_combat_state_start_returns_round_state():
    payload = {
        "participants": [
            {
                "participant_id": "ayane",
                "side": "heroes",
                "dexterity_modifier": 2,
                "current_hp": 28,
                "max_hp": 28,
            },
            {
                "participant_id": "bandit",
                "side": "enemies",
                "dexterity_modifier": 1,
                "current_hp": 11,
                "max_hp": 11,
            },
        ]
    }

    response = client.post("/combat/state/start", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["round_number"] == 1
    assert body["turn_index"] == 0
    assert body["active_participant_id"] in {"ayane", "bandit"}
    assert len(body["initiative_order"]) == 2
    assert len(body["participants"]) == 2


def test_combat_state_next_advances_turn():
    state = {
        "round_number": 1,
        "turn_index": 0,
        "active_participant_id": "ayane",
        "initiative_order": [
            {
                "participant_id": "ayane",
                "roll": 15,
                "modifier": 2,
                "total": 17,
                "nat20": False,
                "nat1": False,
            },
            {
                "participant_id": "bandit",
                "roll": 12,
                "modifier": 1,
                "total": 13,
                "nat20": False,
                "nat1": False,
            },
        ],
        "participants": [
            {
                "participant_id": "ayane",
                "side": "heroes",
                "current_hp": 28,
                "max_hp": 28,
                "defeated": False,
            },
            {
                "participant_id": "bandit",
                "side": "enemies",
                "current_hp": 11,
                "max_hp": 11,
                "defeated": False,
            },
        ],
        "combat_finished": False,
    }

    response = client.post("/combat/state/next", json=state)

    assert response.status_code == 200
    assert response.json()["active_participant_id"] == "bandit"


def test_encounter_turn_resolve_returns_backend_controlled_turn_result():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "ayane",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
            ],
            "combat_finished": False,
        },
        "action": {
            "action_type": "attack",
            "actor_id": "ayane",
            "target_id": "bandit",
            "attack_modifier": 5,
            "target_ac": 14,
            "damage_dice_count": 1,
            "damage_die_sides": 8,
            "damage_modifier": 3,
        },
    }

    response = client.post("/encounter/turn/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["rules_result"]["actor_id"] == "ayane"
    assert body["rules_result"]["target_id"] == "bandit"
    assert 1 <= body["rules_result"]["attack"]["roll"] <= 20
    assert body["rules_result"]["hp"]["previous_hp"] == 11
    assert body["rules_result"]["hp"]["remaining_hp"] <= 11
    assert body["state"]["active_participant_id"] in {"ayane", "bandit"}
    assert body["hud_events"][0]["type"] == "attack_roll"
    assert body["turn_events"] == [
        {"type": "encounter_attack", "actor_id": "ayane", "target_id": "bandit"}
    ]


def test_encounter_turn_resolve_rejects_inactive_actor():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "ayane",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
            ],
            "combat_finished": False,
        },
        "action": {
            "action_type": "attack",
            "actor_id": "bandit",
            "target_id": "ayane",
            "attack_modifier": 3,
            "target_ac": 14,
            "damage_dice_count": 1,
            "damage_die_sides": 6,
            "damage_modifier": 1,
        },
    }

    response = client.post("/encounter/turn/resolve", json=payload)

    assert response.status_code == 422
    assert "active_participant_id" in response.json()["detail"]


def test_save_encounter_turn_resolve_persists_encounter_state():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "encounter-turn",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
                "encounter": {
                    "round_number": 1,
                    "turn_index": 0,
                    "active_participant_id": "ayane",
                    "initiative_order": [
                        {
                            "participant_id": "ayane",
                            "roll": 15,
                            "modifier": 2,
                            "total": 17,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "bandit",
                            "roll": 12,
                            "modifier": 1,
                            "total": 13,
                            "nat20": False,
                            "nat1": False,
                        },
                    ],
                    "participants": [
                        {
                            "participant_id": "ayane",
                            "side": "heroes",
                            "current_hp": 28,
                            "max_hp": 28,
                            "defeated": False,
                        },
                        {
                            "participant_id": "bandit",
                            "side": "enemies",
                            "current_hp": 11,
                            "max_hp": 11,
                            "defeated": False,
                        },
                    ],
                    "combat_finished": False,
                },
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post(
            "/saves/encounter-turn/encounter/turn/resolve",
            json={
                "action": {
                    "action_type": "attack",
                    "actor_id": "ayane",
                    "target_id": "bandit",
                    "attack_modifier": 5,
                    "target_ac": 14,
                    "damage_dice_count": 1,
                    "damage_die_sides": 8,
                    "damage_modifier": 3,
                }
            },
        )
        load_response = client.get("/saves/encounter-turn")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        body = action_response.json()
        assert body["slot_name"] == "encounter-turn"
        assert body["state"]["encounter"]["active_participant_id"] in {"ayane", "bandit"}
        assert body["rules_result"]["actor_id"] == "ayane"
        assert body["hud_events"][0]["type"] == "attack_roll"
        assert load_response.json()["state"]["encounter"]["active_participant_id"] == body["state"]["encounter"]["active_participant_id"]
        verify_db = TestingSessionLocal()
        try:
            persisted_encounter = verify_db.query(Encounter).one()
            persisted_log = verify_db.query(EncounterTurnLog).one()
            assert persisted_encounter.active_participant_id == body["state"]["encounter"]["active_participant_id"]
            assert persisted_log.actor_id == "ayane"
            assert persisted_log.target_id == "bandit"
            assert persisted_log.hud_events[0]["type"] == "attack_roll"
        finally:
            verify_db.close()
    finally:
        main.app.dependency_overrides.clear()


def test_save_encounter_turn_resolve_rejects_save_without_encounter():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "no-encounter",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post(
            "/saves/no-encounter/encounter/turn/resolve",
            json={
                "action": {
                    "action_type": "attack",
                    "actor_id": "ayane",
                    "target_id": "bandit",
                    "attack_modifier": 5,
                    "target_ac": 14,
                    "damage_dice_count": 1,
                    "damage_die_sides": 8,
                    "damage_modifier": 3,
                }
            },
        )

        assert create_response.status_code == 200
        assert action_response.status_code == 422
        assert action_response.json()["detail"] == "Save game has no active encounter"
    finally:
        main.app.dependency_overrides.clear()


def test_encounter_enemy_turn_resolve_returns_backend_enemy_action():
    payload = {
        "round_number": 1,
        "turn_index": 1,
        "active_participant_id": "bandit",
        "initiative_order": [
            {
                "participant_id": "ayane",
                "roll": 15,
                "modifier": 2,
                "total": 17,
                "nat20": False,
                "nat1": False,
            },
            {
                "participant_id": "bandit",
                "roll": 12,
                "modifier": 1,
                "total": 13,
                "nat20": False,
                "nat1": False,
            },
            {
                "participant_id": "johan",
                "roll": 8,
                "modifier": 0,
                "total": 8,
                "nat20": False,
                "nat1": False,
            },
        ],
        "participants": [
            {
                "participant_id": "ayane",
                "side": "heroes",
                "current_hp": 28,
                "max_hp": 28,
                "defeated": False,
                "armor_class": 16,
            },
            {
                "participant_id": "bandit",
                "side": "enemies",
                "current_hp": 11,
                "max_hp": 11,
                "defeated": False,
                "attack": {
                    "attack_modifier": 4,
                    "damage_dice_count": 1,
                    "damage_die_sides": 6,
                    "damage_modifier": 2,
                },
            },
            {
                "participant_id": "johan",
                "side": "heroes",
                "current_hp": 24,
                "max_hp": 24,
                "defeated": False,
                "armor_class": 14,
            },
        ],
        "combat_finished": False,
    }

    response = client.post("/encounter/enemy-turn/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["rules_result"]["actor_id"] == "bandit"
    assert body["rules_result"]["target_id"] == "ayane"
    assert body["rules_result"]["attack"]["target_ac"] == 16
    assert body["rules_result"]["hp"]["previous_hp"] == 28
    assert body["rules_result"]["hp"]["remaining_hp"] <= 28
    assert body["state"]["active_participant_id"] == "johan"
    assert body["turn_events"][0] == {
        "type": "encounter_enemy_target_selected",
        "actor_id": "bandit",
        "target_id": "ayane",
    }
    assert body["hud_events"][0]["type"] == "attack_roll"


def test_encounter_enemy_turn_resolve_rejects_hero_active_turn():
    payload = {
        "round_number": 1,
        "turn_index": 0,
        "active_participant_id": "ayane",
        "initiative_order": [
            {
                "participant_id": "ayane",
                "roll": 15,
                "modifier": 2,
                "total": 17,
                "nat20": False,
                "nat1": False,
            },
            {
                "participant_id": "bandit",
                "roll": 12,
                "modifier": 1,
                "total": 13,
                "nat20": False,
                "nat1": False,
            },
        ],
        "participants": [
            {
                "participant_id": "ayane",
                "side": "heroes",
                "current_hp": 28,
                "max_hp": 28,
                "defeated": False,
            },
            {
                "participant_id": "bandit",
                "side": "enemies",
                "current_hp": 11,
                "max_hp": 11,
                "defeated": False,
            },
        ],
        "combat_finished": False,
    }

    response = client.post("/encounter/enemy-turn/resolve", json=payload)

    assert response.status_code == 422
    assert "not an enemy" in response.json()["detail"]


def test_encounter_player_turn_resolve_accepts_minimal_frontend_action():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "ayane",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                    "attack": {
                        "attack_modifier": 6,
                        "damage_dice_count": 1,
                        "damage_die_sides": 8,
                        "damage_modifier": 4,
                    },
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                    "armor_class": 15,
                },
            ],
            "combat_finished": False,
        },
        "action": {
            "action_type": "attack",
            "actor_id": "ayane",
            "target_id": "bandit",
        },
    }

    response = client.post("/encounter/player-turn/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["rules_result"]["actor_id"] == "ayane"
    assert body["rules_result"]["target_id"] == "bandit"
    assert body["rules_result"]["attack"]["modifier"] == 6
    assert body["rules_result"]["attack"]["target_ac"] == 15
    assert body["rules_result"]["hp"]["previous_hp"] == 11
    assert body["state"]["active_participant_id"] in {"ayane", "bandit"}
    assert body["hud_events"][0]["type"] == "attack_roll"


def test_encounter_player_turn_resolve_rejects_enemy_actor():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "bandit",
            "initiative_order": [
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                },
            ],
            "combat_finished": False,
        },
        "action": {
            "action_type": "attack",
            "actor_id": "bandit",
            "target_id": "ayane",
        },
    }

    response = client.post("/encounter/player-turn/resolve", json=payload)

    assert response.status_code == 422
    assert "not a hero" in response.json()["detail"]


def test_encounter_auto_turn_resolve_routes_hero_action():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "ayane",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
            ],
            "combat_finished": False,
        },
        "action": {
            "action_type": "attack",
            "actor_id": "ayane",
            "target_id": "bandit",
        },
    }

    response = client.post("/encounter/auto-turn/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["rules_result"]["actor_id"] == "ayane"
    assert body["rules_result"]["target_id"] == "bandit"
    assert body["state"]["active_participant_id"] in {"ayane", "bandit"}
    assert body["hud_events"][0]["type"] == "attack_roll"
    assert body["frontend_state"]["round"] == 1
    assert body["frontend_state"]["activeActorId"] == body["state"]["active_participant_id"]
    assert body["frontend_state"]["activeActor"]["id"] == body["state"]["active_participant_id"]
    assert body["frontend_state"]["participants"][0]["id"] == "ayane"
    assert body["frontend_state"]["participants"][0]["currentHp"] == 28
    assert body["frontend_state"]["heroes"][0]["id"] == "ayane"
    assert body["frontend_state"]["heroes"][0]["currentHp"] == 28
    assert body["frontend_state"]["enemies"][0]["id"] == "bandit"
    assert body["frontend_state"]["enemies"][0]["currentHp"] <= 11
    assert body["frontend_state"]["hudEvents"][0]["type"] == "attack_roll"
    if body["frontend_state"]["activeActor"]["kind"] == "enemy":
        assert body["frontend_state"]["turnControl"]["requiresPlayerAction"] is False
        assert body["frontend_state"]["turnControl"]["autoResolvable"] is True
        assert body["frontend_state"]["turnControl"]["availableTargets"][0]["id"] == "ayane"
    else:
        assert body["frontend_state"]["turnControl"]["requiresPlayerAction"] is True
        assert body["frontend_state"]["turnControl"]["autoResolvable"] is False
        assert body["frontend_state"]["turnControl"]["allowedActions"] == ["attack"]
    assert body["frontend_state"]["lastResolution"]["actorId"] == "ayane"
    assert body["frontend_state"]["lastResolution"]["targetId"] == "bandit"
    assert body["frontend_state"]["lastResolution"]["attack"]["hit"] == body["rules_result"]["attack"]["hit"]
    assert body["frontend_state"]["lastResolution"]["attack"]["targetAc"] == 14
    if body["rules_result"]["attack"]["hit"]:
        assert body["frontend_state"]["lastResolution"]["damage"]["total"] >= 1
        assert body["frontend_state"]["lastResolution"]["hp"]["remainingHp"] <= 11
    else:
        assert body["frontend_state"]["lastResolution"]["damage"] is None
        assert body["frontend_state"]["lastResolution"]["hp"]["remainingHp"] == 11


def test_encounter_auto_turn_resolve_routes_enemy_without_action():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 1,
            "active_participant_id": "bandit",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "johan",
                    "roll": 8,
                    "modifier": 0,
                    "total": 8,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                    "armor_class": 16,
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
                {
                    "participant_id": "johan",
                    "side": "heroes",
                    "current_hp": 24,
                    "max_hp": 24,
                    "defeated": False,
                    "armor_class": 14,
                },
            ],
            "combat_finished": False,
        }
    }

    response = client.post("/encounter/auto-turn/resolve", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["rules_result"]["actor_id"] == "bandit"
    assert body["rules_result"]["target_id"] == "ayane"
    assert body["state"]["active_participant_id"] == "johan"
    assert body["turn_events"][0]["type"] == "encounter_enemy_target_selected"
    assert body["hud_events"][0]["type"] == "attack_roll"


def test_encounter_auto_turn_resolve_requires_hero_action():
    payload = {
        "state": {
            "round_number": 1,
            "turn_index": 0,
            "active_participant_id": "ayane",
            "initiative_order": [
                {
                    "participant_id": "ayane",
                    "roll": 15,
                    "modifier": 2,
                    "total": 17,
                    "nat20": False,
                    "nat1": False,
                },
                {
                    "participant_id": "bandit",
                    "roll": 12,
                    "modifier": 1,
                    "total": 13,
                    "nat20": False,
                    "nat1": False,
                },
            ],
            "participants": [
                {
                    "participant_id": "ayane",
                    "side": "heroes",
                    "current_hp": 28,
                    "max_hp": 28,
                    "defeated": False,
                },
                {
                    "participant_id": "bandit",
                    "side": "enemies",
                    "current_hp": 11,
                    "max_hp": 11,
                    "defeated": False,
                },
            ],
            "combat_finished": False,
        }
    }

    response = client.post("/encounter/auto-turn/resolve", json=payload)

    assert response.status_code == 422
    assert "player action is required" in response.json()["detail"]


def test_save_encounter_enemy_turn_resolve_persists_enemy_action():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "enemy-turn",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
                "encounter": {
                    "round_number": 1,
                    "turn_index": 1,
                    "active_participant_id": "bandit",
                    "initiative_order": [
                        {
                            "participant_id": "ayane",
                            "roll": 15,
                            "modifier": 2,
                            "total": 17,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "bandit",
                            "roll": 12,
                            "modifier": 1,
                            "total": 13,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "johan",
                            "roll": 8,
                            "modifier": 0,
                            "total": 8,
                            "nat20": False,
                            "nat1": False,
                        },
                    ],
                    "participants": [
                        {
                            "participant_id": "ayane",
                            "side": "heroes",
                            "current_hp": 28,
                            "max_hp": 28,
                            "defeated": False,
                            "armor_class": 16,
                        },
                        {
                            "participant_id": "bandit",
                            "side": "enemies",
                            "current_hp": 11,
                            "max_hp": 11,
                            "defeated": False,
                            "attack": {
                                "attack_modifier": 4,
                                "damage_dice_count": 1,
                                "damage_die_sides": 6,
                                "damage_modifier": 2,
                            },
                        },
                        {
                            "participant_id": "johan",
                            "side": "heroes",
                            "current_hp": 24,
                            "max_hp": 24,
                            "defeated": False,
                            "armor_class": 14,
                        },
                    ],
                    "combat_finished": False,
                },
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post("/saves/enemy-turn/encounter/enemy-turn/resolve")
        load_response = client.get("/saves/enemy-turn")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        body = action_response.json()
        assert body["slot_name"] == "enemy-turn"
        assert body["rules_result"]["actor_id"] == "bandit"
        assert body["rules_result"]["target_id"] == "ayane"
        assert body["state"]["encounter"]["active_participant_id"] == "johan"
        assert load_response.json()["state"]["encounter"]["active_participant_id"] == "johan"
    finally:
        main.app.dependency_overrides.clear()


def test_save_encounter_player_turn_resolve_persists_minimal_action():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "player-turn",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
                "encounter": {
                    "round_number": 1,
                    "turn_index": 0,
                    "active_participant_id": "ayane",
                    "initiative_order": [
                        {
                            "participant_id": "ayane",
                            "roll": 15,
                            "modifier": 2,
                            "total": 17,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "bandit",
                            "roll": 12,
                            "modifier": 1,
                            "total": 13,
                            "nat20": False,
                            "nat1": False,
                        },
                    ],
                    "participants": [
                        {
                            "participant_id": "ayane",
                            "side": "heroes",
                            "current_hp": 28,
                            "max_hp": 28,
                            "defeated": False,
                            "attack": {
                                "attack_modifier": 6,
                                "damage_dice_count": 1,
                                "damage_die_sides": 8,
                                "damage_modifier": 4,
                            },
                        },
                        {
                            "participant_id": "bandit",
                            "side": "enemies",
                            "current_hp": 11,
                            "max_hp": 11,
                            "defeated": False,
                            "armor_class": 15,
                        },
                    ],
                    "combat_finished": False,
                },
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post(
            "/saves/player-turn/encounter/player-turn/resolve",
            json={
                "action": {
                    "action_type": "attack",
                    "actor_id": "ayane",
                    "target_id": "bandit",
                }
            },
        )
        load_response = client.get("/saves/player-turn")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        body = action_response.json()
        assert body["slot_name"] == "player-turn"
        assert body["rules_result"]["actor_id"] == "ayane"
        assert body["rules_result"]["target_id"] == "bandit"
        assert body["rules_result"]["attack"]["modifier"] == 6
        assert body["rules_result"]["attack"]["target_ac"] == 15
        assert body["state"]["encounter"]["active_participant_id"] in {"ayane", "bandit"}
        assert load_response.json()["state"]["encounter"]["active_participant_id"] == body["state"]["encounter"]["active_participant_id"]
    finally:
        main.app.dependency_overrides.clear()


def test_save_encounter_auto_turn_resolve_persists_enemy_without_action():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "auto-enemy-turn",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
                "encounter": {
                    "round_number": 1,
                    "turn_index": 1,
                    "active_participant_id": "bandit",
                    "initiative_order": [
                        {
                            "participant_id": "ayane",
                            "roll": 15,
                            "modifier": 2,
                            "total": 17,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "bandit",
                            "roll": 12,
                            "modifier": 1,
                            "total": 13,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "johan",
                            "roll": 8,
                            "modifier": 0,
                            "total": 8,
                            "nat20": False,
                            "nat1": False,
                        },
                    ],
                    "participants": [
                        {
                            "participant_id": "ayane",
                            "side": "heroes",
                            "current_hp": 28,
                            "max_hp": 28,
                            "defeated": False,
                            "armor_class": 16,
                        },
                        {
                            "participant_id": "bandit",
                            "side": "enemies",
                            "current_hp": 11,
                            "max_hp": 11,
                            "defeated": False,
                        },
                        {
                            "participant_id": "johan",
                            "side": "heroes",
                            "current_hp": 24,
                            "max_hp": 24,
                            "defeated": False,
                            "armor_class": 14,
                        },
                    ],
                    "combat_finished": False,
                },
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post("/saves/auto-enemy-turn/encounter/auto-turn/resolve", json={})
        load_response = client.get("/saves/auto-enemy-turn")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        body = action_response.json()
        assert body["slot_name"] == "auto-enemy-turn"
        assert body["rules_result"]["actor_id"] == "bandit"
        assert body["rules_result"]["target_id"] == "ayane"
        assert body["state"]["encounter"]["active_participant_id"] == "johan"
        assert body["turn_events"][0]["type"] == "encounter_enemy_target_selected"
        assert body["frontend_state"]["round"] == 1
        assert body["frontend_state"]["turnIndex"] == 2
        assert body["frontend_state"]["activeActorId"] == "johan"
        assert body["frontend_state"]["activeActor"]["name"] == "Johan"
        assert body["frontend_state"]["turnControl"]["requiresPlayerAction"] is True
        assert body["frontend_state"]["turnControl"]["autoResolvable"] is False
        assert body["frontend_state"]["turnControl"]["allowedActions"] == ["attack"]
        assert body["frontend_state"]["turnControl"]["availableTargets"][0]["id"] == "bandit"
        assert [participant["id"] for participant in body["frontend_state"]["participants"]] == [
            "ayane",
            "bandit",
            "johan",
        ]
        assert body["frontend_state"]["heroes"][0]["id"] == "ayane"
        assert body["frontend_state"]["heroes"][0]["currentHp"] <= 28
        assert body["frontend_state"]["heroes"][1]["id"] == "johan"
        assert body["frontend_state"]["heroes"][1]["currentHp"] == 24
        assert body["frontend_state"]["enemies"][0]["id"] == "bandit"
        assert body["frontend_state"]["enemies"][0]["currentHp"] == 11
        assert body["frontend_state"]["lastBackendEvents"][0]["type"] == "attack_roll"
        assert body["frontend_state"]["lastResolution"]["actorId"] == "bandit"
        assert body["frontend_state"]["lastResolution"]["targetId"] == "ayane"
        assert body["frontend_state"]["lastResolution"]["attack"]["hit"] is True
        assert body["frontend_state"]["lastResolution"]["damage"]["total"] >= 1
        assert body["frontend_state"]["lastResolution"]["hp"]["remainingHp"] <= 28
        assert load_response.json()["state"]["encounter"]["active_participant_id"] == "johan"
        verify_db = TestingSessionLocal()
        try:
            persisted_encounter = verify_db.query(Encounter).one()
            persisted_log = verify_db.query(EncounterTurnLog).one()
            assert persisted_encounter.active_participant_id == "johan"
            assert persisted_log.actor_id == "bandit"
            assert persisted_log.target_id == "ayane"
            assert persisted_log.turn_events[0]["type"] == "encounter_enemy_target_selected"
        finally:
            verify_db.close()
    finally:
        main.app.dependency_overrides.clear()


def test_get_persisted_encounter_and_turn_logs():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "persisted-read",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
                "encounter": {
                    "round_number": 1,
                    "turn_index": 0,
                    "active_participant_id": "ayane",
                    "initiative_order": [
                        {
                            "participant_id": "ayane",
                            "roll": 15,
                            "modifier": 2,
                            "total": 17,
                            "nat20": False,
                            "nat1": False,
                        },
                        {
                            "participant_id": "bandit",
                            "roll": 12,
                            "modifier": 1,
                            "total": 13,
                            "nat20": False,
                            "nat1": False,
                        },
                    ],
                    "participants": [
                        {
                            "participant_id": "ayane",
                            "side": "heroes",
                            "current_hp": 28,
                            "max_hp": 28,
                            "defeated": False,
                        },
                        {
                            "participant_id": "bandit",
                            "side": "enemies",
                            "current_hp": 11,
                            "max_hp": 11,
                            "defeated": False,
                        },
                    ],
                    "combat_finished": False,
                },
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post(
            "/saves/persisted-read/encounter/auto-turn/resolve",
            json={
                "action": {
                    "action_type": "attack",
                    "actor_id": "ayane",
                    "target_id": "bandit",
                }
            },
        )
        encounter_response = client.get("/saves/persisted-read/encounter/persisted")
        logs_response = client.get("/saves/persisted-read/encounter/turn-logs")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        assert encounter_response.status_code == 200
        assert logs_response.status_code == 200

        encounter_body = encounter_response.json()
        logs_body = logs_response.json()
        assert encounter_body["slot_name"] == "persisted-read"
        assert encounter_body["encounter"]["active_participant_id"] == action_response.json()["state"]["encounter"]["active_participant_id"]
        assert logs_body["slot_name"] == "persisted-read"
        assert len(logs_body["turn_logs"]) == 1
        assert logs_body["turn_logs"][0]["actor_id"] == "ayane"
        assert logs_body["turn_logs"][0]["target_id"] == "bandit"
        assert logs_body["turn_logs"][0]["hud_events"][0]["type"] == "attack_roll"
    finally:
        main.app.dependency_overrides.clear()


def test_get_persisted_encounter_rejects_save_without_encounter_row():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "no-persisted-encounter",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
            },
        }

        create_response = client.post("/saves", json=save_payload)
        encounter_response = client.get("/saves/no-persisted-encounter/encounter/persisted")
        logs_response = client.get("/saves/no-persisted-encounter/encounter/turn-logs")

        assert create_response.status_code == 200
        assert encounter_response.status_code == 404
        assert encounter_response.json()["detail"] == "Persisted encounter not found"
        assert logs_response.status_code == 404
        assert logs_response.json()["detail"] == "Persisted encounter not found"
    finally:
        main.app.dependency_overrides.clear()


def test_ai_dm_narrate_returns_text_and_visible_rules(monkeypatch):
    captured_context = {}

    def fake_narration(scene_title, player_choice, rules_result, character_state, inventory, enemies):
        captured_context["enemies"] = enemies
        return f"{scene_title}: {player_choice}"

    monkeypatch.setattr(main, "generate_ai_dm_narration", fake_narration)
    payload = {
        "scene_title": "Warehouse",
        "player_choice": "Attack the bandit",
        "rules_result": {
            "attack": {"hit": True},
            "damage": {"total": 7},
            "hp": {"remaining_hp": 4},
        },
        "character_state": {"character_id": "ayane", "current_hp": 28},
        "enemies": [{"enemy_id": "bandit", "current_hp": 4, "max_hp": 11}],
        "inventory": [{"item_id": "torch", "name": "Torch", "quantity": 1}],
    }

    response = client.post("/ai-dm/narrate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["narration"] == "Warehouse: Attack the bandit"
    assert body["visible_rules_result"] == payload["rules_result"]
    assert [event["type"] for event in body["hud_events"]] == ["attack_roll", "damage", "hp_change"]
    assert body["hud_events"][1]["payload"]["total"] == 7
    assert body["state_locked"] is True
    assert captured_context["enemies"] == payload["enemies"]


def test_inventory_catalog_contains_item_actions():
    response = client.get("/inventory/catalog")

    assert response.status_code == 200
    catalog = {item["item_id"]: item for item in response.json()}
    assert "use" in catalog["healing_potion"]["actions"]
    assert "equip" in catalog["leather_armor"]["actions"]


def test_inventory_view_enriches_save_inventory_items():
    payload = {
        "inventory": [
            {"item_id": "healing_potion", "name": "Healing Potion", "quantity": 2},
            {"item_id": "leather_armor", "name": "Leather Armor", "quantity": 1},
        ]
    }

    response = client.post("/inventory/view", json=payload)

    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["actions"] == ["use", "drop"]
    assert items[1]["equipment_slot"] == "armor"


def test_inventory_action_uses_healing_potion():
    payload = {
        "item_id": "healing_potion",
        "action": "use",
        "state": {
            "main_character": {
                "character_id": "ayane",
                "current_hp": 10,
                "max_hp": 28,
            },
            "story_flags": {},
            "inventory": [
                {"item_id": "healing_potion", "name": "Healing Potion", "quantity": 1},
            ],
        },
    }

    response = client.post("/inventory/action", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert 14 <= body["state"]["main_character"]["current_hp"] <= 20
    assert body["state"]["inventory"] == []
    assert [event["type"] for event in body["events"]] == ["inventory_use", "hp_change"]
    healing = body["events"][1]["payload"]["healing"]
    assert len(healing["rolls"]) == 2
    assert all(1 <= roll <= 4 for roll in healing["rolls"])
    assert healing["modifier"] == 2
    assert healing["total"] == sum(healing["rolls"]) + 2


def test_inventory_action_rejects_invalid_item_action():
    payload = {
        "item_id": "torch",
        "action": "equip",
        "state": {
            "main_character": {
                "character_id": "ayane",
                "current_hp": 28,
                "max_hp": 28,
            },
            "story_flags": {},
            "inventory": [
                {"item_id": "torch", "name": "Torch", "quantity": 1},
            ],
        },
    }

    response = client.post("/inventory/action", json=payload)

    assert response.status_code == 422
    assert "not allowed" in response.json()["detail"]


def test_create_and_load_save_game():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "autosave",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                    "conditions": [],
                },
                "npc_companion": {
                    "character_id": "johan",
                    "current_hp": 24,
                    "max_hp": 24,
                    "conditions": [],
                },
                "story_flags": {"egg_stolen": True},
                "inventory": [
                    {"item_id": "torch", "name": "Torch", "quantity": 1},
                ],
            },
        }

        create_response = client.post("/saves", json=save_payload)
        load_response = client.get("/saves/autosave")

        assert create_response.status_code == 200
        assert load_response.status_code == 200
        assert load_response.json()["slot_name"] == "autosave"
        assert load_response.json()["character_id"] == "ayane"
        assert load_response.json()["state"]["story_flags"]["egg_stolen"] is True
        assert load_response.json()["state"]["main_character"]["current_hp"] == 28
    finally:
        main.app.dependency_overrides.clear()


def test_save_inventory_action_persists_updated_state():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "inventory-action",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 10,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [
                    {"item_id": "healing_potion", "name": "Healing Potion", "quantity": 1},
                ],
            },
        }

        create_response = client.post("/saves", json=save_payload)
        action_response = client.post(
            "/saves/inventory-action/inventory/action",
            json={"item_id": "healing_potion", "action": "use"},
        )
        load_response = client.get("/saves/inventory-action")

        assert create_response.status_code == 200
        assert action_response.status_code == 200
        body = action_response.json()
        assert body["slot_name"] == "inventory-action"
        assert 14 <= body["state"]["main_character"]["current_hp"] <= 20
        assert body["state"]["inventory"] == []
        assert load_response.json()["state"]["main_character"]["current_hp"] == body["state"]["main_character"]["current_hp"]
        assert load_response.json()["state"]["inventory"] == []
    finally:
        main.app.dependency_overrides.clear()


def test_save_inventory_action_rejects_unknown_slot():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        response = client.post(
            "/saves/missing/inventory/action",
            json={"item_id": "healing_potion", "action": "use"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Save game not found"
    finally:
        main.app.dependency_overrides.clear()


def test_create_save_rejects_unknown_scene():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "bad-scene",
            "character_id": "ayane",
            "scene_number": 999,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
            },
        }

        response = client.post("/saves", json=save_payload)

        assert response.status_code == 404
        assert response.json()["detail"] == "Scene not found"
    finally:
        main.app.dependency_overrides.clear()


def test_create_save_rejects_mismatched_main_character():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "wrong-main-character",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "johan",
                    "current_hp": 24,
                    "max_hp": 24,
                },
                "story_flags": {},
                "inventory": [],
            },
        }

        response = client.post("/saves", json=save_payload)

        assert response.status_code == 422
        assert response.json()["detail"] == "Main character must match character_id"
    finally:
        main.app.dependency_overrides.clear()


def test_list_and_delete_save_game():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        save_payload = {
            "slot_name": "delete-me",
            "character_id": "ayane",
            "scene_number": 1,
            "state": {
                "main_character": {
                    "character_id": "ayane",
                    "current_hp": 28,
                    "max_hp": 28,
                },
                "story_flags": {},
                "inventory": [],
            },
        }

        create_response = client.post("/saves", json=save_payload)
        list_response = client.get("/saves")
        delete_response = client.delete("/saves/delete-me")
        load_response = client.get("/saves/delete-me")

        assert create_response.status_code == 200
        assert list_response.status_code == 200
        assert list_response.json()[0]["slot_name"] == "delete-me"
        assert "state" not in list_response.json()[0]
        assert delete_response.status_code == 200
        assert delete_response.json() == {"status": "deleted", "slot_name": "delete-me"}
        assert load_response.status_code == 404
    finally:
        main.app.dependency_overrides.clear()


def test_load_unknown_save_returns_404():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        response = client.get("/saves/missing")

        assert response.status_code == 404
        assert response.json()["detail"] == "Save game not found"
    finally:
        main.app.dependency_overrides.clear()
