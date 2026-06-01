import random
from collections.abc import Callable


Roller = Callable[[int, int], int]


def roll(sides: int, roller: Roller | None = None) -> int:
    if sides < 1:
        raise ValueError("sides must be greater than 0")
    roll_func = roller or random.randint
    return roll_func(1, sides)


def roll_d20(modifier: int = 0, roller: Roller | None = None) -> dict:
    result = roll(20, roller)
    return {
        "roll": result,
        "modifier": modifier,
        "total": result + modifier,
        "nat20": result == 20,
        "nat1": result == 1,
    }


def roll_with_advantage(modifier: int = 0, roller: Roller | None = None) -> dict:
    r1, r2 = roll(20, roller), roll(20, roller)
    chosen = max(r1, r2)
    return {
        "rolls": [r1, r2],
        "chosen": chosen,
        "modifier": modifier,
        "total": chosen + modifier,
        "nat20": chosen == 20,
        "nat1": chosen == 1,
    }


def roll_with_disadvantage(modifier: int = 0, roller: Roller | None = None) -> dict:
    r1, r2 = roll(20, roller), roll(20, roller)
    chosen = min(r1, r2)
    return {
        "rolls": [r1, r2],
        "chosen": chosen,
        "modifier": modifier,
        "total": chosen + modifier,
        "nat20": chosen == 20,
        "nat1": chosen == 1,
    }


def skill_check(modifier: int, dc: int, roller: Roller | None = None) -> dict:
    if dc < 1:
        raise ValueError("dc must be greater than 0")
    result = roll_d20(modifier, roller)
    result["dc"] = dc
    result["success"] = result["nat20"] or (not result["nat1"] and result["total"] >= dc)
    return result


def attack_roll(attack_modifier: int, target_ac: int, roller: Roller | None = None) -> dict:
    if target_ac < 1:
        raise ValueError("target_ac must be greater than 0")
    result = roll_d20(attack_modifier, roller)
    result["target_ac"] = target_ac
    result["hit"] = result["nat20"] or (not result["nat1"] and result["total"] >= target_ac)
    result["critical"] = result["nat20"]
    return result


def roll_damage(
    dice_count: int,
    die_sides: int,
    modifier: int = 0,
    critical: bool = False,
    roller: Roller | None = None,
) -> dict:
    if dice_count < 1:
        raise ValueError("dice_count must be greater than 0")
    if die_sides < 1:
        raise ValueError("die_sides must be greater than 0")

    total_dice = dice_count * 2 if critical else dice_count
    rolls = [roll(die_sides, roller) for _ in range(total_dice)]
    total = max(0, sum(rolls) + modifier)
    return {
        "dice_count": dice_count,
        "die_sides": die_sides,
        "modifier": modifier,
        "critical": critical,
        "rolls": rolls,
        "total": total,
    }


def apply_damage(current_hp: int, damage: int) -> dict:
    if current_hp < 0:
        raise ValueError("current_hp must be greater than or equal to 0")
    if damage < 0:
        raise ValueError("damage must be greater than or equal to 0")

    remaining_hp = max(0, current_hp - damage)
    return {
        "previous_hp": current_hp,
        "damage": damage,
        "remaining_hp": remaining_hp,
        "defeated": remaining_hp == 0,
    }


def resolve_attack(
    attack_modifier: int,
    target_ac: int,
    damage_dice_count: int,
    damage_die_sides: int,
    damage_modifier: int,
    target_current_hp: int,
    roller: Roller | None = None,
) -> dict:
    attack = attack_roll(attack_modifier, target_ac, roller)
    if not attack["hit"]:
        return {
            "attack": attack,
            "damage": None,
            "hp": apply_damage(target_current_hp, 0),
        }

    damage = roll_damage(
        damage_dice_count,
        damage_die_sides,
        damage_modifier,
        critical=attack["critical"],
        roller=roller,
    )
    return {
        "attack": attack,
        "damage": damage,
        "hp": apply_damage(target_current_hp, damage["total"]),
    }


def roll_initiative(
    participant_id: str,
    dexterity_modifier: int,
    roller: Roller | None = None,
) -> dict:
    result = roll_d20(dexterity_modifier, roller)
    return {
        "participant_id": participant_id,
        "roll": result["roll"],
        "modifier": dexterity_modifier,
        "total": result["total"],
        "nat20": result["nat20"],
        "nat1": result["nat1"],
    }


def build_initiative_order(participants: list[dict], roller: Roller | None = None) -> list[dict]:
    if not participants:
        raise ValueError("participants must not be empty")

    initiative_results = [
        roll_initiative(
            participant_id=participant["participant_id"],
            dexterity_modifier=participant["dexterity_modifier"],
            roller=roller,
        )
        for participant in participants
    ]
    return sorted(
        initiative_results,
        key=lambda item: (item["total"], item["modifier"], item["participant_id"]),
        reverse=True,
    )


def stat_modifier(stat: int) -> int:
    return (stat - 10) // 2
