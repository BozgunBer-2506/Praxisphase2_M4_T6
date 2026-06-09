from dice import apply_damage, attack_roll, resolve_attack, roll_damage


DEFAULT_ENEMY_ATTACK = {
    "attack_modifier": 3,
    "target_ac": 14,
    "damage_dice_count": 1,
    "damage_die_sides": 6,
    "damage_modifier": 1,
}

DEFAULT_HERO_ATTACK = {
    "attack_modifier": 5,
    "target_ac": 14,
    "damage_dice_count": 1,
    "damage_die_sides": 8,
    "damage_modifier": 3,
}


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
                "armor_class": participant.get("armor_class"),
                "attack": participant.get("attack"),
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
                "pending_damage": None,
            }

    return {**state, "active_participant_id": None, "combat_finished": True}


def resolve_encounter_turn(state: dict, action: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")
    if action["action_type"] != "attack":
        raise ValueError(f"Unsupported encounter action '{action['action_type']}'")
    if action["actor_id"] != state["active_participant_id"]:
        raise ValueError("actor_id must match active_participant_id")

    participants = [dict(participant) for participant in state["participants"]]
    actor = _participant_by_id(participants, action["actor_id"])
    target = _participant_by_id(participants, action["target_id"])
    if not actor:
        raise ValueError("actor not found")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")
    if not target:
        raise ValueError("target not found")
    if target["defeated"]:
        raise ValueError("defeated target cannot be attacked")

    rules_result = resolve_attack(
        attack_modifier=action["attack_modifier"],
        target_ac=action["target_ac"],
        damage_dice_count=action["damage_dice_count"],
        damage_die_sides=action["damage_die_sides"],
        damage_modifier=action.get("damage_modifier", 0),
        target_current_hp=target["current_hp"],
        roller=roller,
    )
    target["current_hp"] = rules_result["hp"]["remaining_hp"]
    target["defeated"] = rules_result["hp"]["defeated"]

    updated_state = {
        **state,
        "participants": participants,
    }
    next_state = advance_turn(updated_state)
    return {
        "state": next_state,
        "rules_result": {
            "actor_id": action["actor_id"],
            "target_id": action["target_id"],
            **rules_result,
        },
        "turn_events": [
            {
                "type": "encounter_attack",
                "actor_id": action["actor_id"],
                "target_id": action["target_id"],
            }
        ],
    }


def resolve_encounter_attack_roll(state: dict, action: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")
    if state.get("pending_damage"):
        pending_actor = state["pending_damage"].get("actor_id")
        if pending_actor == state.get("active_participant_id"):
            raise ValueError("pending damage must be resolved before another attack roll")
        state = {**state, "pending_damage": None}
    if action["action_type"] != "attack":
        raise ValueError(f"Unsupported encounter action '{action['action_type']}'")
    if action["actor_id"] != state["active_participant_id"]:
        raise ValueError("actor_id must match active_participant_id")

    participants = [dict(participant) for participant in state["participants"]]
    actor = _participant_by_id(participants, action["actor_id"])
    target = _participant_by_id(participants, action["target_id"])
    if not actor:
        raise ValueError("actor not found")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")
    if not target:
        raise ValueError("target not found")
    if target["defeated"]:
        raise ValueError("defeated target cannot be attacked")

    attack = attack_roll(action["attack_modifier"], action["target_ac"], roller)
    rules_result = {
        "actor_id": action["actor_id"],
        "target_id": action["target_id"],
        "attack": attack,
        "damage": None,
        "hp": None,
        "awaiting_damage_roll": attack["hit"],
    }

    if not attack["hit"]:
        return {
            "state": advance_turn({**state, "participants": participants, "pending_damage": None}),
            "rules_result": rules_result,
            "turn_events": [
                {
                    "type": "encounter_attack_roll",
                    "actor_id": action["actor_id"],
                    "target_id": action["target_id"],
                    "hit": False,
                }
            ],
        }

    pending_damage = {
        "actor_id": action["actor_id"],
        "target_id": action["target_id"],
        "damage_dice_count": action["damage_dice_count"],
        "damage_die_sides": action["damage_die_sides"],
        "damage_modifier": action.get("damage_modifier", 0),
        "critical": attack["critical"],
        "target_current_hp": target["current_hp"],
    }
    return {
        "state": {
            **state,
            "participants": participants,
            "pending_damage": pending_damage,
        },
        "rules_result": rules_result,
        "turn_events": [
            {
                "type": "encounter_attack_roll",
                "actor_id": action["actor_id"],
                "target_id": action["target_id"],
                "hit": True,
            }
        ],
    }


def resolve_encounter_damage_roll(state: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")

    pending_damage = state.get("pending_damage")
    if not pending_damage:
        raise ValueError("pending damage is required")
    if pending_damage["actor_id"] != state["active_participant_id"]:
        raise ValueError("pending damage actor must match active_participant_id")

    participants = [dict(participant) for participant in state["participants"]]
    target = _participant_by_id(participants, pending_damage["target_id"])
    if not target:
        raise ValueError("target not found")
    if target["defeated"]:
        raise ValueError("defeated target cannot receive pending damage")

    damage = roll_damage(
        pending_damage["damage_dice_count"],
        pending_damage["damage_die_sides"],
        pending_damage.get("damage_modifier", 0),
        critical=pending_damage.get("critical", False),
        roller=roller,
    )
    hp = apply_damage(target["current_hp"], damage["total"])
    target["current_hp"] = hp["remaining_hp"]
    target["defeated"] = hp["defeated"]

    updated_state = {
        **state,
        "participants": participants,
        "pending_damage": None,
    }
    return {
        "state": advance_turn(updated_state),
        "rules_result": {
            "actor_id": pending_damage["actor_id"],
            "target_id": pending_damage["target_id"],
            "attack": None,
            "damage": damage,
            "hp": hp,
            "awaiting_damage_roll": False,
        },
        "turn_events": [
            {
                "type": "encounter_damage_roll",
                "actor_id": pending_damage["actor_id"],
                "target_id": pending_damage["target_id"],
            }
        ],
    }


def resolve_enemy_turn(state: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")

    participants = [dict(participant) for participant in state["participants"]]
    actor = _participant_by_id(participants, state["active_participant_id"])
    if not actor:
        raise ValueError("active participant not found")
    if actor["side"] != "enemies":
        raise ValueError("active participant is not an enemy")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")

    target = _first_living_participant_by_side(participants, "heroes")
    if not target:
        return {
            "state": {**state, "participants": participants, "active_participant_id": None, "combat_finished": True},
            "rules_result": {"actor_id": actor["participant_id"], "target_id": None, "combat_finished": True},
            "turn_events": [{"type": "encounter_enemy_no_target", "actor_id": actor["participant_id"]}],
        }

    attack = {**DEFAULT_ENEMY_ATTACK, **(actor.get("attack") or {})}
    action = {
        "action_type": "attack",
        "actor_id": actor["participant_id"],
        "target_id": target["participant_id"],
        "attack_modifier": attack["attack_modifier"],
        "target_ac": target.get("armor_class") or attack["target_ac"],
        "damage_dice_count": attack["damage_dice_count"],
        "damage_die_sides": attack["damage_die_sides"],
        "damage_modifier": attack.get("damage_modifier", 0),
    }
    result = resolve_encounter_turn({**state, "participants": participants}, action, roller=roller)
    result["turn_events"].insert(
        0,
        {
            "type": "encounter_enemy_target_selected",
            "actor_id": actor["participant_id"],
            "target_id": target["participant_id"],
        },
    )
    return result


def resolve_player_turn(state: dict, action: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")
    if action["action_type"] != "attack":
        raise ValueError(f"Unsupported encounter action '{action['action_type']}'")
    if action["actor_id"] != state["active_participant_id"]:
        raise ValueError("actor_id must match active_participant_id")

    participants = [dict(participant) for participant in state["participants"]]
    actor = _participant_by_id(participants, action["actor_id"])
    target = _participant_by_id(participants, action["target_id"])
    if not actor:
        raise ValueError("actor not found")
    if actor["side"] != "heroes":
        raise ValueError("active participant is not a hero")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")
    if not target:
        raise ValueError("target not found")
    if target["side"] != "enemies":
        raise ValueError("player attacks must target enemies")
    if target["defeated"]:
        raise ValueError("defeated target cannot be attacked")

    attack = {**DEFAULT_HERO_ATTACK, **(actor.get("attack") or {})}
    backend_action = {
        "action_type": "attack",
        "actor_id": actor["participant_id"],
        "target_id": target["participant_id"],
        "attack_modifier": attack["attack_modifier"],
        "target_ac": target.get("armor_class") or attack["target_ac"],
        "damage_dice_count": attack["damage_dice_count"],
        "damage_die_sides": attack["damage_die_sides"],
        "damage_modifier": attack.get("damage_modifier", 0),
    }
    return resolve_encounter_turn({**state, "participants": participants}, backend_action, roller=roller)


def resolve_player_attack_roll(state: dict, action: dict, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")
    if action["action_type"] != "attack":
        raise ValueError(f"Unsupported encounter action '{action['action_type']}'")
    if action["actor_id"] != state["active_participant_id"]:
        raise ValueError("actor_id must match active_participant_id")

    participants = [dict(participant) for participant in state["participants"]]
    actor = _participant_by_id(participants, action["actor_id"])
    target = _participant_by_id(participants, action["target_id"])
    if not actor:
        raise ValueError("actor not found")
    if actor["side"] != "heroes":
        raise ValueError("active participant is not a hero")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")
    if not target:
        raise ValueError("target not found")
    if target["side"] != "enemies":
        raise ValueError("player attacks must target enemies")
    if target["defeated"]:
        raise ValueError("defeated target cannot be attacked")

    attack = {**DEFAULT_HERO_ATTACK, **(actor.get("attack") or {})}
    backend_action = {
        "action_type": "attack",
        "actor_id": actor["participant_id"],
        "target_id": target["participant_id"],
        "attack_modifier": attack["attack_modifier"],
        "target_ac": target.get("armor_class") or attack["target_ac"],
        "damage_dice_count": attack["damage_dice_count"],
        "damage_die_sides": attack["damage_die_sides"],
        "damage_modifier": attack.get("damage_modifier", 0),
    }
    return resolve_encounter_attack_roll({**state, "participants": participants}, backend_action, roller=roller)


def resolve_auto_turn(state: dict, action: dict | None = None, roller=None) -> dict:
    if state["combat_finished"]:
        raise ValueError("combat is already finished")

    actor = _participant_by_id(state["participants"], state["active_participant_id"])
    if not actor:
        raise ValueError("active participant not found")
    if actor["defeated"]:
        raise ValueError("defeated actor cannot act")

    if actor["side"] == "heroes":
        if action is None:
            raise ValueError("player action is required for hero turns")
        return resolve_player_turn(state, action, roller=roller)
    if actor["side"] == "enemies":
        if action is not None:
            raise ValueError("enemy turns do not accept player actions")
        return resolve_enemy_turn(state, roller=roller)

    raise ValueError(f"Unsupported participant side '{actor['side']}'")


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


def _first_living_participant_by_side(participants: list[dict], side: str) -> dict | None:
    return next(
        (participant for participant in participants if participant["side"] == side and not participant["defeated"]),
        None,
    )
