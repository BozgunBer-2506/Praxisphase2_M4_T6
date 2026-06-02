import pytest

from dice import (
    apply_damage,
    attack_roll,
    build_initiative_order,
    resolve_attack,
    roll,
    roll_d20,
    roll_damage,
    roll_with_advantage,
    roll_with_disadvantage,
    skill_check,
    stat_modifier,
)


def fixed_roll(value):
    def roller(min_value, max_value):
        assert min_value == 1
        assert value <= max_value
        return value

    return roller


def sequence_roll(values):
    rolls = iter(values)

    def roller(min_value, max_value):
        value = next(rolls)
        assert min_value == 1
        assert value <= max_value
        return value

    return roller


def test_roll_rejects_invalid_sides():
    with pytest.raises(ValueError, match="sides"):
        roll(0)


def test_roll_d20_uses_injected_roller():
    result = roll_d20(modifier=3, roller=fixed_roll(12))

    assert result["roll"] == 12
    assert result["modifier"] == 3
    assert result["total"] == 15
    assert result["nat20"] is False
    assert result["nat1"] is False


def test_advantage_chooses_higher_roll():
    result = roll_with_advantage(modifier=1, roller=sequence_roll([4, 17]))

    assert result["rolls"] == [4, 17]
    assert result["chosen"] == 17
    assert result["total"] == 18


def test_disadvantage_chooses_lower_roll():
    result = roll_with_disadvantage(modifier=1, roller=sequence_roll([4, 17]))

    assert result["rolls"] == [4, 17]
    assert result["chosen"] == 4
    assert result["total"] == 5


def test_skill_check_handles_nat20_and_nat1():
    nat20 = skill_check(modifier=-5, dc=30, roller=fixed_roll(20))
    nat1 = skill_check(modifier=20, dc=5, roller=fixed_roll(1))

    assert nat20["success"] is True
    assert nat1["success"] is False


def test_skill_check_rejects_invalid_dc():
    with pytest.raises(ValueError, match="dc"):
        skill_check(modifier=0, dc=0)


def test_attack_roll_handles_hit_miss_and_critical():
    hit = attack_roll(attack_modifier=5, target_ac=15, roller=fixed_roll(10))
    miss = attack_roll(attack_modifier=0, target_ac=15, roller=fixed_roll(10))
    critical = attack_roll(attack_modifier=-5, target_ac=30, roller=fixed_roll(20))

    assert hit["hit"] is True
    assert miss["hit"] is False
    assert critical["hit"] is True
    assert critical["critical"] is True


def test_attack_roll_rejects_invalid_ac():
    with pytest.raises(ValueError, match="target_ac"):
        attack_roll(attack_modifier=0, target_ac=0)


def test_roll_damage_rolls_damage_dice():
    result = roll_damage(
        dice_count=2,
        die_sides=6,
        modifier=3,
        roller=sequence_roll([4, 5]),
    )

    assert result["rolls"] == [4, 5]
    assert result["total"] == 12
    assert result["critical"] is False


def test_roll_damage_doubles_dice_on_critical():
    result = roll_damage(
        dice_count=1,
        die_sides=8,
        modifier=2,
        critical=True,
        roller=sequence_roll([7, 3]),
    )

    assert result["rolls"] == [7, 3]
    assert result["total"] == 12
    assert result["critical"] is True


def test_apply_damage_reduces_hp_without_negative_result():
    result = apply_damage(current_hp=5, damage=12)

    assert result == {
        "previous_hp": 5,
        "damage": 12,
        "remaining_hp": 0,
        "defeated": True,
    }


def test_resolve_attack_skips_damage_on_miss():
    result = resolve_attack(
        attack_modifier=0,
        target_ac=18,
        damage_dice_count=1,
        damage_die_sides=8,
        damage_modifier=3,
        target_current_hp=20,
        roller=sequence_roll([5]),
    )

    assert result["attack"]["hit"] is False
    assert result["damage"] is None
    assert result["hp"]["remaining_hp"] == 20


def test_resolve_attack_applies_damage_on_hit():
    result = resolve_attack(
        attack_modifier=5,
        target_ac=12,
        damage_dice_count=1,
        damage_die_sides=8,
        damage_modifier=3,
        target_current_hp=20,
        roller=sequence_roll([10, 6]),
    )

    assert result["attack"]["hit"] is True
    assert result["damage"]["total"] == 9
    assert result["hp"]["remaining_hp"] == 11


def test_build_initiative_order_sorts_by_total_descending():
    participants = [
        {"participant_id": "ayane", "dexterity_modifier": 2},
        {"participant_id": "goblin", "dexterity_modifier": 1},
        {"participant_id": "johan", "dexterity_modifier": 0},
    ]

    result = build_initiative_order(participants, roller=sequence_roll([10, 18, 12]))

    assert [item["participant_id"] for item in result] == ["goblin", "ayane", "johan"]
    assert [item["total"] for item in result] == [19, 12, 12]


def test_build_initiative_order_uses_modifier_as_tiebreaker():
    participants = [
        {"participant_id": "ayane", "dexterity_modifier": 2},
        {"participant_id": "johan", "dexterity_modifier": 0},
    ]

    result = build_initiative_order(participants, roller=sequence_roll([10, 12]))

    assert [item["participant_id"] for item in result] == ["ayane", "johan"]
    assert [item["total"] for item in result] == [12, 12]


def test_build_initiative_order_rejects_empty_participants():
    with pytest.raises(ValueError, match="participants"):
        build_initiative_order([])


def test_stat_modifier_matches_dnd_formula():
    assert stat_modifier(8) == -1
    assert stat_modifier(10) == 0
    assert stat_modifier(15) == 2
    assert stat_modifier(20) == 5
