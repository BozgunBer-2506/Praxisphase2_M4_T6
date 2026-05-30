import random


def roll(sides: int) -> int:
    return random.randint(1, sides)


def roll_d20(modifier: int = 0) -> dict:
    result = roll(20)
    return {
        "roll": result,
        "modifier": modifier,
        "total": result + modifier,
        "nat20": result == 20,
        "nat1": result == 1,
    }


def roll_with_advantage(modifier: int = 0) -> dict:
    r1, r2 = roll(20), roll(20)
    chosen = max(r1, r2)
    return {
        "rolls": [r1, r2],
        "chosen": chosen,
        "modifier": modifier,
        "total": chosen + modifier,
        "nat20": chosen == 20,
        "nat1": chosen == 1,
    }


def roll_with_disadvantage(modifier: int = 0) -> dict:
    r1, r2 = roll(20), roll(20)
    chosen = min(r1, r2)
    return {
        "rolls": [r1, r2],
        "chosen": chosen,
        "modifier": modifier,
        "total": chosen + modifier,
        "nat20": chosen == 20,
        "nat1": chosen == 1,
    }


def skill_check(modifier: int, dc: int) -> dict:
    result = roll_d20(modifier)
    result["dc"] = dc
    result["success"] = result["nat20"] or (not result["nat1"] and result["total"] >= dc)
    return result


def attack_roll(attack_modifier: int, target_ac: int) -> dict:
    result = roll_d20(attack_modifier)
    result["target_ac"] = target_ac
    result["hit"] = result["nat20"] or (not result["nat1"] and result["total"] >= target_ac)
    result["critical"] = result["nat20"]
    return result


def stat_modifier(stat: int) -> int:
    return (stat - 10) // 2
