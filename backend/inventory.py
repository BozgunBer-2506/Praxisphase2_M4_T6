from dice import roll_damage


ITEM_CATALOG = {
    "torch": {
        "item_id": "torch",
        "name": "Torch",
        "category": "utility",
        "description": "A simple torch for dark places.",
        "actions": ["use", "drop"],
        "effect": {"light": True},
    },
    "healing_potion": {
        "item_id": "healing_potion",
        "name": "Healing Potion",
        "category": "consumable",
        "description": "Restores a small amount of HP when used.",
        "actions": ["use", "drop"],
        "effect": {"heal": {"dice_count": 2, "die_sides": 4, "modifier": 2}},
    },
    "leather_armor": {
        "item_id": "leather_armor",
        "name": "Leather Armor",
        "category": "armor",
        "description": "Light armor with base AC 11 plus dexterity modifier.",
        "actions": ["equip", "unequip", "drop"],
        "equipment_slot": "armor",
        "effect": {"armor_class": {"base": 11, "dexterity_modifier": True}},
    },
    "shortsword": {
        "item_id": "shortsword",
        "name": "Shortsword",
        "category": "weapon",
        "description": "A finesse melee weapon.",
        "actions": ["equip", "unequip", "drop"],
        "equipment_slot": "main_hand",
        "effect": {"damage": {"dice_count": 1, "die_sides": 6, "damage_type": "piercing"}},
    },
}


def roll_healing(dice_count: int, die_sides: int, modifier: int, roller=None) -> dict:
    return roll_damage(dice_count, die_sides, modifier, roller=roller)


def list_item_catalog() -> list[dict]:
    return [definition.copy() for definition in ITEM_CATALOG.values()]


def get_item_definition(item_id: str) -> dict:
    definition = ITEM_CATALOG.get(item_id)
    if definition:
        return definition.copy()
    return {
        "item_id": item_id,
        "name": item_id,
        "category": "unknown",
        "description": "Unknown item. No actions are available until it is defined.",
        "actions": [],
        "effect": {},
    }


def build_inventory_view(inventory_state: list[dict]) -> list[dict]:
    view = []
    for item in inventory_state:
        definition = get_item_definition(item["item_id"])
        view.append(
            {
                **definition,
                "name": item.get("name") or definition["name"],
                "quantity": item.get("quantity", 1),
                "equipped": item.get("equipped", False),
            }
        )
    return view


def apply_inventory_action(
    state: dict,
    item_id: str,
    action: str,
    roller=None,
) -> dict:
    next_state = {
        **state,
        "main_character": dict(state["main_character"]),
        "inventory": [dict(item) for item in state.get("inventory", [])],
    }
    item = _find_inventory_item(next_state["inventory"], item_id)
    definition = get_item_definition(item_id)
    if action not in definition["actions"]:
        raise ValueError(f"Action '{action}' is not allowed for item '{item_id}'")

    events = []
    if action == "use":
        events.extend(_use_item(next_state, item, definition, roller))
    elif action == "equip":
        events.extend(_equip_item(next_state, item, definition))
    elif action == "unequip":
        item["equipped"] = False
        events.append({"type": "inventory_unequip", "item_id": item_id})
    elif action == "drop":
        _consume_item(next_state["inventory"], item)
        events.append({"type": "inventory_drop", "item_id": item_id})
    else:
        raise ValueError(f"Unsupported inventory action '{action}'")

    return {"state": next_state, "inventory": build_inventory_view(next_state["inventory"]), "events": events}


def _find_inventory_item(inventory_state: list[dict], item_id: str) -> dict:
    for item in inventory_state:
        if item["item_id"] == item_id:
            return item
    raise ValueError(f"Item '{item_id}' is not in inventory")


def _use_item(state: dict, item: dict, definition: dict, roller) -> list[dict]:
    events = [{"type": "inventory_use", "item_id": item["item_id"]}]
    heal = definition.get("effect", {}).get("heal")
    if heal:
        result = roll_healing(heal["dice_count"], heal["die_sides"], heal.get("modifier", 0), roller=roller)
        character = state["main_character"]
        previous_hp = character["current_hp"]
        character["current_hp"] = min(character["max_hp"], previous_hp + result["total"])
        events.append(
            {
                "type": "hp_change",
                "item_id": item["item_id"],
                "payload": {
                    "previous_hp": previous_hp,
                    "remaining_hp": character["current_hp"],
                    "healing": result,
                },
            }
        )
    _consume_item(state["inventory"], item)
    return events


def _equip_item(state: dict, item: dict, definition: dict) -> list[dict]:
    equipment_slot = definition.get("equipment_slot")
    if not equipment_slot:
        raise ValueError(f"Item '{item['item_id']}' has no equipment slot")
    for inventory_item in state["inventory"]:
        inventory_definition = get_item_definition(inventory_item["item_id"])
        if inventory_definition.get("equipment_slot") == equipment_slot:
            inventory_item["equipped"] = False
    item["equipped"] = True
    return [{"type": "inventory_equip", "item_id": item["item_id"], "equipment_slot": equipment_slot}]


def _consume_item(inventory_state: list[dict], item: dict) -> None:
    item["quantity"] = item.get("quantity", 1) - 1
    if item["quantity"] <= 0:
        inventory_state.remove(item)
