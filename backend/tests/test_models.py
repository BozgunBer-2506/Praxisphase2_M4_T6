from database import Base
import models


def test_encounter_tables_are_registered_for_persistence():
    tables = Base.metadata.tables

    assert "encounters" in tables
    assert "encounter_turn_logs" in tables


def test_encounter_model_contains_combat_state_columns():
    columns = models.Encounter.__table__.columns

    assert "save_game_id" in columns
    assert "round_number" in columns
    assert "turn_index" in columns
    assert "active_participant_id" in columns
    assert "combat_finished" in columns
    assert "participants" in columns
    assert "initiative_order" in columns


def test_encounter_turn_log_model_contains_visible_rules_columns():
    columns = models.EncounterTurnLog.__table__.columns

    assert "encounter_id" in columns
    assert "actor_id" in columns
    assert "target_id" in columns
    assert "action_type" in columns
    assert "rules_result" in columns
    assert "hud_events" in columns
    assert "turn_events" in columns
