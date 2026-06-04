from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from encounter_persistence import create_encounter_turn_log, encounter_to_state, upsert_encounter_from_save_state
from models import Encounter, EncounterTurnLog, SaveGame


ENCOUNTER_STATE = {
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
            "armor_class": 16,
            "attack": None,
        },
        {
            "participant_id": "bandit",
            "side": "enemies",
            "current_hp": 11,
            "max_hp": 11,
            "defeated": False,
            "armor_class": 15,
            "attack": None,
        },
    ],
    "combat_finished": False,
}


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def make_save_game(db, encounter_state=ENCOUNTER_STATE):
    save_game = SaveGame(
        slot_name="encounter-slot",
        character_id="ayane",
        scene_number=1,
        state={
            "main_character": {
                "character_id": "ayane",
                "current_hp": 28,
                "max_hp": 28,
            },
            "story_flags": {},
            "inventory": [],
            "encounter": encounter_state,
        },
    )
    db.add(save_game)
    db.commit()
    db.refresh(save_game)
    return save_game


def test_upsert_encounter_from_save_state_creates_row():
    db = make_session()
    save_game = make_save_game(db)

    encounter = upsert_encounter_from_save_state(db, save_game)
    db.commit()

    persisted = db.query(Encounter).one()
    assert encounter.id == persisted.id
    assert persisted.save_game_id == save_game.id
    assert persisted.round_number == 1
    assert persisted.active_participant_id == "ayane"
    assert persisted.participants[1]["participant_id"] == "bandit"


def test_upsert_encounter_from_save_state_updates_existing_row():
    db = make_session()
    save_game = make_save_game(db)
    encounter = upsert_encounter_from_save_state(db, save_game)
    db.commit()

    next_state = {**ENCOUNTER_STATE, "round_number": 2, "turn_index": 1, "active_participant_id": "bandit"}
    save_game.state = {**save_game.state, "encounter": next_state}
    updated = upsert_encounter_from_save_state(db, save_game)
    db.commit()

    assert updated.id == encounter.id
    assert db.query(Encounter).count() == 1
    assert updated.round_number == 2
    assert updated.active_participant_id == "bandit"


def test_encounter_to_state_returns_combat_state_shape():
    db = make_session()
    save_game = make_save_game(db)
    encounter = upsert_encounter_from_save_state(db, save_game)

    state = encounter_to_state(encounter)

    assert state == ENCOUNTER_STATE


def test_create_encounter_turn_log_persists_visible_rules_result():
    db = make_session()
    save_game = make_save_game(db)
    encounter = upsert_encounter_from_save_state(db, save_game)
    result = {
        "rules_result": {
            "actor_id": "ayane",
            "target_id": "bandit",
            "attack": {"roll": 12, "modifier": 5, "total": 17, "hit": True},
            "hp": {"previous_hp": 11, "damage": 7, "remaining_hp": 4, "defeated": False},
        },
        "hud_events": [{"type": "attack_roll", "label": "Attack Roll"}],
        "turn_events": [{"type": "encounter_attack", "actor_id": "ayane", "target_id": "bandit"}],
    }

    turn_log = create_encounter_turn_log(db, encounter, result)
    db.commit()

    persisted = db.query(EncounterTurnLog).one()
    assert persisted.id == turn_log.id
    assert persisted.actor_id == "ayane"
    assert persisted.target_id == "bandit"
    assert persisted.rules_result["attack"]["hit"] is True
    assert persisted.hud_events[0]["type"] == "attack_roll"
