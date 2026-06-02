import json

import ai_dm
from ai_dm import build_ai_dm_prompt, build_hud_events, fallback_narration, generate_ai_dm_narration


def test_prompt_forbids_ai_state_changes():
    prompt = build_ai_dm_prompt(
        scene_title="Warehouse",
        player_choice="Attack the bandit",
        rules_result={"hit": True, "damage": 7},
        character_state={"current_hp": 20},
        enemies=[{"enemy_id": "bandit", "current_hp": 4}],
        inventory=[{"item_id": "torch", "quantity": 1}],
    )

    assert "Schreibe nur atmosphaerischen Erzaehlertext" in prompt
    assert "Du darfst keine HP" in prompt
    assert "Inventory-Werte" in prompt
    assert "Alle Spielwerte sind bereits vom Backend validiert" in prompt
    assert "Gegnerstatus" in prompt
    assert "bandit" in prompt


def test_fallback_narration_uses_rules_result_without_state_changes():
    narration = fallback_narration(
        scene_title="Warehouse",
        player_choice="Attack the bandit",
        rules_result={"hit": True},
    )

    assert "Warehouse" in narration
    assert "Attack the bandit" in narration


def test_build_hud_events_from_combat_rules_result():
    rules_result = {
        "attack": {"roll": 15, "total": 20, "hit": True},
        "damage": {"rolls": [4, 3], "total": 9},
        "hp": {"previous_hp": 13, "remaining_hp": 4},
    }

    events = build_hud_events(rules_result)

    assert [event["type"] for event in events] == ["attack_roll", "damage", "hp_change"]
    assert events[0]["payload"] == rules_result["attack"]
    assert events[1]["payload"]["total"] == 9


def test_build_hud_events_from_skill_check_result():
    rules_result = {"roll": 11, "modifier": 3, "total": 14, "success": True}

    events = build_hud_events(rules_result)

    assert events == [
        {
            "type": "skill_check",
            "label": "Skill Check",
            "payload": rules_result,
        }
    ]


def test_generate_ai_dm_narration_without_api_key_uses_fallback(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    narration = generate_ai_dm_narration(
        scene_title="Warehouse",
        player_choice="Attack the bandit",
        rules_result={"attack": {"hit": False}},
        character_state={"current_hp": 20},
        enemies=[{"enemy_id": "bandit", "current_hp": 4}],
        inventory=[],
        api_key=None,
    )

    assert "Warehouse" in narration
    assert "Die Lage kippt" in narration


def test_generate_ai_dm_narration_falls_back_on_api_error(monkeypatch):
    def broken_urlopen(request, timeout):
        raise TimeoutError("network unavailable")

    monkeypatch.setattr(ai_dm.urllib.request, "urlopen", broken_urlopen)

    narration = generate_ai_dm_narration(
        scene_title="Warehouse",
        player_choice="Attack the bandit",
        rules_result={"hit": True},
        character_state={"current_hp": 20},
        enemies=[],
        inventory=[],
        api_key="test-key",
    )

    assert "Warehouse" in narration
    assert "Die Entscheidung zeigt Wirkung" in narration


def test_generate_ai_dm_narration_rejects_json_output(monkeypatch):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return json.dumps(
                {"choices": [{"message": {"content": "{\"hp\": 0}"}}]}
            ).encode()

    def fake_urlopen(request, timeout):
        return FakeResponse()

    monkeypatch.setattr(ai_dm.urllib.request, "urlopen", fake_urlopen)

    narration = generate_ai_dm_narration(
        scene_title="Warehouse",
        player_choice="Attack the bandit",
        rules_result={"hit": True},
        character_state={"current_hp": 20},
        enemies=[],
        inventory=[],
        api_key="test-key",
    )

    assert narration.startswith("Warehouse: Attack the bandit")
    assert "{\"hp\": 0}" not in narration
