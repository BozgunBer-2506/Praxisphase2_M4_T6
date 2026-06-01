from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
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
