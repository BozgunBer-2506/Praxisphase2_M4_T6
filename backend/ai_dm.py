import json

try:
    import anthropic
    from aws_bedrock_token_generator import provide_token
    _BEDROCK_AVAILABLE = True
except ImportError:
    _BEDROCK_AVAILABLE = False

DEFAULT_AI_MODEL = "anthropic.claude-haiku-4-5"
BEDROCK_BASE_URL = "https://bedrock-mantle.eu-central-1.api.aws/anthropic"

HELP_COMMANDS = {"/help", "/lore", "/rules", "/recap"}
BLOCKED_EXTERNAL_LORE_TERMS = ("the originals", "new orleans", "new-orleans", "mikaelson")


def build_ai_dm_help_response(
    message: str,
    scene_context: dict | None = None,
    rules_result: dict | None = None,
    character_state: dict | None = None,
    inventory: list[dict] | None = None,
) -> dict:
    command = _normalize_help_command(message)
    if _contains_blocked_external_lore(message):
        return _help_response(
            command=command,
            answer=(
                "Ich kann nur zu Falkenwacht, der aktuellen Szene, Bedienung und erklaerender "
                "DnD-5e-Regelhilfe antworten. Externe Lore wie The Originals oder New Orleans "
                "gehoert nicht zu diesem Projektkontext."
            ),
            topics=["scope"],
        )

    if command == "/help":
        return _help_response(
            command=command,
            answer=(
                "Verfuegbare DM-Hilfe: /help zeigt diese Uebersicht, /lore erklaert Falkenwacht-Kontext, "
                "/rules erklaert sichtbare DnD-5e-Mechanik, /recap fasst den aktuellen Stand zusammen. "
                "Freie Fragen sind moeglich, solange sie Szene, Lore, Spielmechanik oder Bedienung betreffen."
            ),
            topics=["help", "commands", "usage"],
        )
    if command == "/lore":
        scene_title = (scene_context or {}).get("title") or "Falkenwacht"
        location = (scene_context or {}).get("location") or "aktueller Schauplatz"
        return _help_response(
            command=command,
            answer=(
                f"Lore-Hilfe: Du befindest dich im Falkenwacht-Kontext. Aktuelle Szene: {scene_title}. "
                f"Schauplatz: {location}. Ich erklaere nur bekannte Hinweise aus Szene und Backend-Kontext "
                "und erfinde keine fremden Fraktionen, Serien-Lore oder neue Items."
            ),
            topics=["lore", "falkenwacht", "scene"],
        )
    if command == "/rules":
        return _help_response(
            command=command,
            answer=_rules_help_text(rules_result),
            topics=["rules", "dnd5e", "backend"],
        )
    if command == "/recap":
        return _help_response(
            command=command,
            answer=_recap_text(scene_context, rules_result, character_state, inventory),
            topics=["recap", "state", "scene"],
        )

    return _help_response(
        command="free_question",
        answer=(
            "Ich kann deine Frage beantworten, wenn sie sich auf die aktuelle Szene, Falkenwacht-Lore, "
            "sichtbare Backend-Regelergebnisse, DnD-5e-Grundmechanik oder Bedienung bezieht. "
            "Ich veraendere dabei keine HP, Wuerfe, Treffer, Schaden, Inventory oder Speicherstaende."
        ),
        topics=["free_question", "scope"],
    )


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


def _help_response(command: str, answer: str, topics: list[str]) -> dict:
    return {
        "command": command,
        "answer": answer,
        "topics": topics,
        "state_locked": True,
        "allowed_scope": ["falkenwacht", "current_scene", "backend_rules", "dnd5e_help", "usage"],
    }


def _normalize_help_command(message: str) -> str:
    first_token = message.strip().split(maxsplit=1)[0].lower() if message.strip() else "/help"
    return first_token if first_token in HELP_COMMANDS else "free_question"


def _contains_blocked_external_lore(message: str) -> bool:
    normalized = message.lower()
    return any(term in normalized for term in BLOCKED_EXTERNAL_LORE_TERMS)


def _rules_help_text(rules_result: dict | None) -> str:
    if not rules_result:
        return (
            "Regelhilfe: Das Backend wuerfelt und bewertet Regeln. Ein d20-Wurf plus Modifikator "
            "wird gegen eine Schwierigkeit oder Armor Class verglichen. Das Frontend zeigt nur an."
        )
    if isinstance(rules_result.get("attack"), dict):
        attack = rules_result["attack"]
        hit_text = "Treffer" if attack.get("hit") else "Fehlschlag"
        return (
            f"Regelhilfe Angriff: d20 {attack.get('roll')} plus Modifikator {attack.get('modifier')} "
            f"ergibt {attack.get('total')} gegen AC {attack.get('target_ac')}: {hit_text}. "
            "Schaden und HP-Aenderungen werden nur vom Backend berechnet."
        )
    if "success" in rules_result:
        return (
            f"Regelhilfe Probe: Gesamtwert {rules_result.get('total')} gegen DC {rules_result.get('dc', 'unbekannt')}. "
            "Das Backend entscheidet Erfolg oder Fehlschlag."
        )
    return "Regelhilfe: Das sichtbare Regelergebnis wurde vom Backend validiert und darf nur erklaert werden."


def _recap_text(
    scene_context: dict | None,
    rules_result: dict | None,
    character_state: dict | None,
    inventory: list[dict] | None,
) -> str:
    scene_title = (scene_context or {}).get("title") or "aktuelle Szene"
    hp = (character_state or {}).get("current_hp")
    max_hp = (character_state or {}).get("max_hp")
    inventory_count = len(inventory or [])
    parts = [f"Recap: Aktuell bist du in {scene_title}."]
    if hp is not None and max_hp is not None:
        parts.append(f"Sichtbare HP: {hp}/{max_hp}.")
    if rules_result:
        parts.append("Das letzte sichtbare Regelergebnis liegt vor und bleibt backendvalidiert.")
    parts.append(f"Inventory-Eintraege im Kontext: {inventory_count}.")
    return " ".join(parts)


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

    if not _BEDROCK_AVAILABLE:
        return fallback

    prompt = build_ai_dm_prompt(
        scene_title=scene_title,
        player_choice=player_choice,
        rules_result=rules_result,
        character_state=character_state,
        enemies=enemies or [],
        inventory=inventory,
    )

    try:
        client = anthropic.Anthropic(
            api_key=provide_token(),
            base_url=BEDROCK_BASE_URL,
            default_headers={"anthropic-workspace-id": "default"},
        )
        message = client.messages.create(
            model=model,
            max_tokens=180,
            messages=[{"role": "user", "content": prompt}],
        )
        narration = message.content[0].text
        return _clean_ai_narration(narration, fallback)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Bedrock error: %s", e)
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
