import pytest

from combat import (
    advance_turn,
    create_combat_state,
    resolve_auto_turn,
    resolve_encounter_attack_roll,
    resolve_encounter_damage_roll,
    resolve_encounter_turn,
    resolve_enemy_turn,
    resolve_player_turn,
)


INITIATIVE_ORDER = [
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
]


def sequence_roller(values):
    rolls = iter(values)
    return lambda _minimum, _maximum: next(rolls)


def test_create_combat_state_sets_first_active_participant():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]

    state = create_combat_state(participants, INITIATIVE_ORDER)

    assert state["round_number"] == 1
    assert state["turn_index"] == 0
    assert state["active_participant_id"] == "ayane"
    assert state["combat_finished"] is False


def test_create_combat_state_marks_defeated_participants():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 0, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]

    state = create_combat_state(participants, INITIATIVE_ORDER)

    assert state["active_participant_id"] == "bandit"
    assert state["participants"][0]["defeated"] is True


def test_create_combat_state_rejects_mismatched_initiative_order():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
    ]

    with pytest.raises(ValueError, match="same participants"):
        create_combat_state(participants, INITIATIVE_ORDER)


def test_advance_turn_moves_to_next_active_participant():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)

    next_state = advance_turn(state)

    assert next_state["round_number"] == 1
    assert next_state["turn_index"] == 1
    assert next_state["active_participant_id"] == "bandit"


def test_advance_turn_starts_next_round_after_order_wrap():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["turn_index"] = 2
    state["active_participant_id"] = "johan"

    next_state = advance_turn(state)

    assert next_state["round_number"] == 2
    assert next_state["turn_index"] == 0
    assert next_state["active_participant_id"] == "ayane"


def test_resolve_encounter_turn_rolls_attack_damage_and_advances_turn():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "ayane",
        "target_id": "bandit",
        "attack_modifier": 5,
        "target_ac": 14,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
    }

    result = resolve_encounter_turn(state, action, roller=sequence_roller([12, 4]))

    assert result["rules_result"]["attack"]["roll"] == 12
    assert result["rules_result"]["attack"]["hit"] is True
    assert result["rules_result"]["damage"]["rolls"] == [4]
    assert result["rules_result"]["hp"]["remaining_hp"] == 4
    assert result["state"]["active_participant_id"] == "bandit"
    bandit = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "bandit")
    assert bandit["current_hp"] == 4
    assert result["turn_events"] == [
        {"type": "encounter_attack", "actor_id": "ayane", "target_id": "bandit"}
    ]


def test_resolve_encounter_turn_rejects_inactive_actor():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "johan",
        "target_id": "bandit",
        "attack_modifier": 5,
        "target_ac": 14,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
    }

    with pytest.raises(ValueError, match="active_participant_id"):
        resolve_encounter_turn(state, action, roller=sequence_roller([12, 4]))


def test_resolve_encounter_attack_roll_creates_pending_damage_on_hit_without_hp_change():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "ayane",
        "target_id": "bandit",
        "attack_modifier": 5,
        "target_ac": 14,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
    }

    result = resolve_encounter_attack_roll(state, action, roller=sequence_roller([12]))

    assert result["rules_result"]["attack"]["hit"] is True
    assert result["rules_result"]["damage"] is None
    assert result["rules_result"]["hp"] is None
    assert result["rules_result"]["awaiting_damage_roll"] is True
    assert result["state"]["active_participant_id"] == "ayane"
    assert result["state"]["pending_damage"] == {
        "actor_id": "ayane",
        "target_id": "bandit",
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
        "critical": False,
        "target_current_hp": 11,
    }
    bandit = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "bandit")
    assert bandit["current_hp"] == 11


def test_resolve_encounter_attack_roll_advances_turn_on_miss_without_pending_damage():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "ayane",
        "target_id": "bandit",
        "attack_modifier": 1,
        "target_ac": 20,
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
    }

    result = resolve_encounter_attack_roll(state, action, roller=sequence_roller([2]))

    assert result["rules_result"]["attack"]["hit"] is False
    assert result["rules_result"]["awaiting_damage_roll"] is False
    assert result["state"]["pending_damage"] is None
    assert result["state"]["active_participant_id"] == "bandit"
    bandit = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "bandit")
    assert bandit["current_hp"] == 11


def test_resolve_encounter_damage_roll_consumes_pending_damage_and_advances_turn():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["pending_damage"] = {
        "actor_id": "ayane",
        "target_id": "bandit",
        "damage_dice_count": 1,
        "damage_die_sides": 8,
        "damage_modifier": 3,
        "critical": False,
        "target_current_hp": 11,
    }

    result = resolve_encounter_damage_roll(state, roller=sequence_roller([4]))

    assert result["rules_result"]["damage"]["rolls"] == [4]
    assert result["rules_result"]["damage"]["total"] == 7
    assert result["rules_result"]["hp"]["remaining_hp"] == 4
    assert result["state"]["pending_damage"] is None
    assert result["state"]["active_participant_id"] == "bandit"
    bandit = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "bandit")
    assert bandit["current_hp"] == 4


def test_resolve_enemy_turn_targets_first_living_hero_and_advances_turn():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28, "armor_class": 16},
        {
            "participant_id": "bandit",
            "side": "enemies",
            "current_hp": 11,
            "max_hp": 11,
            "attack": {
                "attack_modifier": 4,
                "damage_dice_count": 1,
                "damage_die_sides": 6,
                "damage_modifier": 2,
            },
        },
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24, "armor_class": 14},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["turn_index"] = 1
    state["active_participant_id"] = "bandit"

    result = resolve_enemy_turn(state, roller=sequence_roller([13, 5]))

    assert result["rules_result"]["actor_id"] == "bandit"
    assert result["rules_result"]["target_id"] == "ayane"
    assert result["rules_result"]["attack"]["target_ac"] == 16
    assert result["rules_result"]["attack"]["hit"] is True
    assert result["rules_result"]["damage"]["total"] == 7
    ayane = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "ayane")
    assert ayane["current_hp"] == 21
    assert result["state"]["active_participant_id"] == "johan"
    assert result["turn_events"][0] == {
        "type": "encounter_enemy_target_selected",
        "actor_id": "bandit",
        "target_id": "ayane",
    }


def test_resolve_enemy_turn_rejects_non_enemy_actor():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)

    with pytest.raises(ValueError, match="not an enemy"):
        resolve_enemy_turn(state, roller=sequence_roller([13, 5]))


def test_resolve_player_turn_uses_backend_attack_stats_and_target_ac():
    participants = [
        {
            "participant_id": "ayane",
            "side": "heroes",
            "current_hp": 28,
            "max_hp": 28,
            "attack": {
                "attack_modifier": 6,
                "damage_dice_count": 1,
                "damage_die_sides": 8,
                "damage_modifier": 4,
            },
        },
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11, "armor_class": 15},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "ayane",
        "target_id": "bandit",
    }

    result = resolve_player_turn(state, action, roller=sequence_roller([10, 4]))

    assert result["rules_result"]["actor_id"] == "ayane"
    assert result["rules_result"]["target_id"] == "bandit"
    assert result["rules_result"]["attack"]["modifier"] == 6
    assert result["rules_result"]["attack"]["target_ac"] == 15
    assert result["rules_result"]["attack"]["hit"] is True
    assert result["rules_result"]["damage"]["total"] == 8
    bandit = next(participant for participant in result["state"]["participants"] if participant["participant_id"] == "bandit")
    assert bandit["current_hp"] == 3
    assert result["state"]["active_participant_id"] == "bandit"


def test_resolve_player_turn_rejects_enemy_actor():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["turn_index"] = 1
    state["active_participant_id"] = "bandit"
    action = {
        "action_type": "attack",
        "actor_id": "bandit",
        "target_id": "ayane",
    }

    with pytest.raises(ValueError, match="not a hero"):
        resolve_player_turn(state, action, roller=sequence_roller([10, 4]))


def test_resolve_auto_turn_routes_hero_turn_to_player_resolver():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    action = {
        "action_type": "attack",
        "actor_id": "ayane",
        "target_id": "bandit",
    }

    result = resolve_auto_turn(state, action=action, roller=sequence_roller([12, 4]))

    assert result["rules_result"]["actor_id"] == "ayane"
    assert result["rules_result"]["target_id"] == "bandit"
    assert result["state"]["active_participant_id"] == "bandit"


def test_resolve_auto_turn_routes_enemy_turn_without_frontend_action():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28, "armor_class": 16},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["turn_index"] = 1
    state["active_participant_id"] = "bandit"

    result = resolve_auto_turn(state, roller=sequence_roller([14, 5]))

    assert result["rules_result"]["actor_id"] == "bandit"
    assert result["rules_result"]["target_id"] == "ayane"
    assert result["state"]["active_participant_id"] == "johan"
    assert result["turn_events"][0]["type"] == "encounter_enemy_target_selected"


def test_resolve_auto_turn_requires_player_action_for_hero_turn():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)

    with pytest.raises(ValueError, match="player action is required"):
        resolve_auto_turn(state, roller=sequence_roller([12, 4]))


def test_resolve_auto_turn_rejects_player_action_for_enemy_turn():
    participants = [
        {"participant_id": "ayane", "side": "heroes", "current_hp": 28, "max_hp": 28},
        {"participant_id": "bandit", "side": "enemies", "current_hp": 11, "max_hp": 11},
        {"participant_id": "johan", "side": "heroes", "current_hp": 24, "max_hp": 24},
    ]
    state = create_combat_state(participants, INITIATIVE_ORDER)
    state["turn_index"] = 1
    state["active_participant_id"] = "bandit"
    action = {
        "action_type": "attack",
        "actor_id": "bandit",
        "target_id": "ayane",
    }

    with pytest.raises(ValueError, match="enemy turns do not accept player actions"):
        resolve_auto_turn(state, action=action, roller=sequence_roller([12, 4]))
