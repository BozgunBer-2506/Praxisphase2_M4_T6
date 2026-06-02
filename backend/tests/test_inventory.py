from inventory import apply_inventory_action, build_inventory_view, get_item_definition, list_item_catalog


def sequence_roller(values):
    rolls = iter(values)
    return lambda _minimum, _maximum: next(rolls)


def test_catalog_contains_usable_and_equipable_items():
    catalog = {item["item_id"]: item for item in list_item_catalog()}

    assert "use" in catalog["healing_potion"]["actions"]
    assert "equip" in catalog["leather_armor"]["actions"]
    assert catalog["leather_armor"]["equipment_slot"] == "armor"


def test_build_inventory_view_adds_actions_and_effects():
    view = build_inventory_view(
        [
            {"item_id": "healing_potion", "name": "Healing Potion", "quantity": 2},
            {"item_id": "leather_armor", "name": "Leather Armor", "quantity": 1},
        ]
    )

    potion, armor = view
    assert potion["actions"] == ["use", "drop"]
    assert potion["effect"]["heal"]["dice_count"] == 2
    assert armor["actions"] == ["equip", "unequip", "drop"]
    assert armor["equipped"] is False


def test_unknown_item_has_no_actions():
    definition = get_item_definition("mystery_key")

    assert definition["category"] == "unknown"
    assert definition["actions"] == []


def test_apply_use_healing_potion_updates_hp_and_quantity():
    state = {
        "main_character": {"character_id": "ayane", "current_hp": 10, "max_hp": 28, "conditions": []},
        "story_flags": {},
        "inventory": [{"item_id": "healing_potion", "name": "Healing Potion", "quantity": 2}],
    }

    result = apply_inventory_action(state, "healing_potion", "use", roller=sequence_roller([1, 4]))

    assert result["state"]["main_character"]["current_hp"] == 17
    assert result["state"]["inventory"][0]["quantity"] == 1
    assert [event["type"] for event in result["events"]] == ["inventory_use", "hp_change"]
    healing = result["events"][1]["payload"]["healing"]
    assert healing["rolls"] == [1, 4]
    assert healing["total"] == 7


def test_apply_use_healing_potion_caps_at_max_hp():
    state = {
        "main_character": {"character_id": "ayane", "current_hp": 25, "max_hp": 28, "conditions": []},
        "story_flags": {},
        "inventory": [{"item_id": "healing_potion", "name": "Healing Potion", "quantity": 1}],
    }

    result = apply_inventory_action(state, "healing_potion", "use", roller=sequence_roller([4, 4]))

    assert result["state"]["main_character"]["current_hp"] == 28
    assert result["events"][1]["payload"]["previous_hp"] == 25
    assert result["events"][1]["payload"]["remaining_hp"] == 28
    assert result["events"][1]["payload"]["healing"]["total"] == 10


def test_apply_equip_marks_same_slot_items_exclusive():
    state = {
        "main_character": {"character_id": "ayane", "current_hp": 28, "max_hp": 28, "conditions": []},
        "story_flags": {},
        "inventory": [
            {"item_id": "shortsword", "name": "Shortsword", "quantity": 1},
            {"item_id": "leather_armor", "name": "Leather Armor", "quantity": 1},
        ],
    }

    result = apply_inventory_action(state, "shortsword", "equip")

    sword = result["state"]["inventory"][0]
    assert sword["equipped"] is True
    assert result["events"] == [
        {"type": "inventory_equip", "item_id": "shortsword", "equipment_slot": "main_hand"}
    ]


def test_apply_inventory_action_rejects_unavailable_action():
    state = {
        "main_character": {"character_id": "ayane", "current_hp": 28, "max_hp": 28, "conditions": []},
        "story_flags": {},
        "inventory": [{"item_id": "torch", "name": "Torch", "quantity": 1}],
    }

    try:
        apply_inventory_action(state, "torch", "equip")
    except ValueError as exc:
        assert "not allowed" in str(exc)
    else:
        raise AssertionError("Expected invalid inventory action to raise")
