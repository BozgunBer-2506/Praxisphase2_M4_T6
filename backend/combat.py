def create_combat_state(participants: list[dict], initiative_order: list[dict]) -> dict:
    if not participants:
        raise ValueError("participants must not be empty")
    if not initiative_order:
        raise ValueError("initiative_order must not be empty")

    participant_ids = {participant["participant_id"] for participant in participants}
    order_ids = {entry["participant_id"] for entry in initiative_order}
    if participant_ids != order_ids:
        raise ValueError("initiative_order must contain the same participants")

    normalized_participants = []
    for participant in participants:
        current_hp = participant["current_hp"]
        max_hp = participant["max_hp"]
        if current_hp > max_hp:
            raise ValueError("current_hp must be less than or equal to max_hp")
        normalized_participants.append(
            {
                "participant_id": participant["participant_id"],
                "side": participant["side"],
                "current_hp": current_hp,
                "max_hp": max_hp,
                "defeated": current_hp == 0,
            }
        )

    active_participant_id = _first_active_participant(initiative_order, normalized_participants)
    return {
        "round_number": 1,
        "turn_index": 0,
        "active_participant_id": active_participant_id,
        "initiative_order": initiative_order,
        "participants": normalized_participants,
        "combat_finished": active_participant_id is None,
    }


def advance_turn(state: dict) -> dict:
    if state["combat_finished"]:
        return state

    order = state["initiative_order"]
    participants = state["participants"]
    current_index = state["turn_index"]

    for offset in range(1, len(order) + 1):
        next_index = (current_index + offset) % len(order)
        next_id = order[next_index]["participant_id"]
        participant = _participant_by_id(participants, next_id)
        if participant and not participant["defeated"]:
            next_round = state["round_number"] + 1 if next_index <= current_index else state["round_number"]
            return {
                **state,
                "round_number": next_round,
                "turn_index": next_index,
                "active_participant_id": next_id,
                "combat_finished": False,
            }

    return {**state, "active_participant_id": None, "combat_finished": True}


def _first_active_participant(initiative_order: list[dict], participants: list[dict]) -> str | None:
    for entry in initiative_order:
        participant = _participant_by_id(participants, entry["participant_id"])
        if participant and not participant["defeated"]:
            return entry["participant_id"]
    return None


def _participant_by_id(participants: list[dict], participant_id: str) -> dict | None:
    return next(
        (participant for participant in participants if participant["participant_id"] == participant_id),
        None,
    )
