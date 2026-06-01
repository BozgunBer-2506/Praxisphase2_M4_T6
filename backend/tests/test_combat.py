import pytest

from combat import advance_turn, create_combat_state


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
