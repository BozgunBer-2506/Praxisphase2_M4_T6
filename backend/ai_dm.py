import json
import os
import urllib.request


DEFAULT_AI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def build_ai_dm_prompt(
    scene_title: str,
    player_choice: str,
    rules_result: dict,
    character_state: dict,
    enemies: list[dict],
    inventory: list[dict],
) -> str:
    return (
        "Du bist der AI-DM fuer eine dunkle DnD-Visual-Novel in Falkenwacht.\n"
        "Schreibe nur atmosphaerischen Erzaehlertext.\n"
        "Du darfst keine HP, Wuerfe, Treffer, Schaden, Inventory-Werte, Items, Saves oder Regeln aendern.\n"
        "Alle Spielwerte sind bereits vom Backend validiert und muessen unveraendert bleiben.\n"
        "Erfinde keine neuen Items und keine neuen Statuseffekte.\n"
        "Gib keinen JSON-Code aus.\n\n"
        f"Szene: {scene_title}\n"
        f"Spielerentscheidung: {player_choice}\n"
        f"Validiertes Regelergebnis: {json.dumps(rules_result, ensure_ascii=False)}\n"
        f"Charakterstatus: {json.dumps(character_state, ensure_ascii=False)}\n"
        f"Gegnerstatus: {json.dumps(enemies, ensure_ascii=False)}\n"
        f"Inventory-Kontext: {json.dumps(inventory, ensure_ascii=False)}\n"
        "Antwort: 2-4 Saetze Erzaehlertext."
    )


def fallback_narration(scene_title: str, player_choice: str, rules_result: dict) -> str:
    success = _extract_success(rules_result)
    if success is True:
        outcome = "Die Entscheidung zeigt Wirkung, und der Weg oeffnet sich einen Schritt weiter."
    elif success is False:
        outcome = "Die Lage kippt, doch die Geschichte bleibt in Bewegung."
    else:
        outcome = "Die Szene reagiert auf deine Entscheidung."

    return f"{scene_title}: {player_choice}. {outcome}"


def build_hud_events(rules_result: dict) -> list[dict]:
    events = []

    if _has_roll_result(rules_result):
        events.append(
            {
                "type": "skill_check",
                "label": "Skill Check",
                "payload": rules_result,
            }
        )

    attack = rules_result.get("attack")
    if isinstance(attack, dict):
        events.append(
            {
                "type": "attack_roll",
                "label": "Attack Roll",
                "payload": attack,
            }
        )

    damage = rules_result.get("damage")
    if isinstance(damage, dict):
        events.append(
            {
                "type": "damage",
                "label": "Damage",
                "payload": damage,
            }
        )

    hp = rules_result.get("hp")
    if isinstance(hp, dict):
        events.append(
            {
                "type": "hp_change",
                "label": "HP",
                "payload": hp,
            }
        )

    return events


def generate_ai_dm_narration(
    scene_title: str,
    player_choice: str,
    rules_result: dict,
    character_state: dict,
    inventory: list[dict],
    enemies: list[dict] | None = None,
    api_key: str | None = None,
    model: str = DEFAULT_AI_MODEL,
) -> str:
    fallback = fallback_narration(scene_title, player_choice, rules_result)
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        return fallback

    prompt = build_ai_dm_prompt(
        scene_title=scene_title,
        player_choice=player_choice,
        rules_result=rules_result,
        character_state=character_state,
        enemies=enemies or [],
        inventory=inventory,
    )

    payload = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 180,
            "temperature": 0.8,
        }
    ).encode()

    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read())
            narration = data["choices"][0]["message"]["content"]
            return _clean_ai_narration(narration, fallback)
    except Exception:
        return fallback


def _clean_ai_narration(narration: str, fallback: str) -> str:
    cleaned = narration.strip()
    if not cleaned:
        return fallback
    if cleaned.startswith(("```", "{", "[")):
        return fallback
    return cleaned[:800]


def _extract_success(rules_result: dict) -> bool | None:
    if "success" in rules_result:
        return bool(rules_result["success"])
    if "hit" in rules_result:
        return bool(rules_result["hit"])
    if "attack" in rules_result and isinstance(rules_result["attack"], dict):
        return bool(rules_result["attack"].get("hit"))
    return None


def _has_roll_result(rules_result: dict) -> bool:
    return any(key in rules_result for key in ("roll", "total", "success"))
