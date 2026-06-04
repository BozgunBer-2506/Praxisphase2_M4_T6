from models import Encounter, EncounterTurnLog, SaveGame


def upsert_encounter_from_save_state(db, save_game: SaveGame) -> Encounter | None:
    encounter_state = (save_game.state or {}).get("encounter")
    if not encounter_state:
        return None

    encounter = (
        db.query(Encounter)
        .filter(Encounter.save_game_id == save_game.id)
        .order_by(Encounter.id.desc())
        .first()
    )
    if encounter is None:
        encounter = Encounter(save_game_id=save_game.id)
        db.add(encounter)

    encounter.round_number = encounter_state["round_number"]
    encounter.turn_index = encounter_state["turn_index"]
    encounter.active_participant_id = encounter_state.get("active_participant_id")
    encounter.combat_finished = encounter_state["combat_finished"]
    encounter.participants = encounter_state["participants"]
    encounter.initiative_order = encounter_state["initiative_order"]
    db.flush()
    return encounter


def encounter_to_state(encounter: Encounter) -> dict:
    return {
        "round_number": encounter.round_number,
        "turn_index": encounter.turn_index,
        "active_participant_id": encounter.active_participant_id,
        "initiative_order": encounter.initiative_order,
        "participants": encounter.participants,
        "combat_finished": encounter.combat_finished,
    }


def create_encounter_turn_log(
    db,
    encounter: Encounter,
    result: dict,
    action_type: str = "attack",
) -> EncounterTurnLog:
    rules_result = result["rules_result"]
    turn_log = EncounterTurnLog(
        encounter_id=encounter.id,
        actor_id=rules_result.get("actor_id"),
        target_id=rules_result.get("target_id"),
        action_type=action_type,
        rules_result=rules_result,
        hud_events=result.get("hud_events", []),
        turn_events=result.get("turn_events", []),
    )
    db.add(turn_log)
    db.flush()
    return turn_log
