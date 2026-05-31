import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from database import engine
from characters import CHARACTERS
from scenes import SCENES
from dice import roll_d20, roll_with_advantage, roll_with_disadvantage, skill_check, attack_roll, stat_modifier

app = FastAPI(title="DnD Visual Novel API")


class SkillCheckRequest(BaseModel):
    character_id: str
    skill: str
    dc: int


class AttackRequest(BaseModel):
    character_id: str
    attack_modifier: int
    target_ac: int


@app.get("/health")
def health():
    try:
        with engine.connect():
            db_status = "ok"
    except Exception:
        db_status = "unreachable"
    return {"status": "ok", "database": db_status}


@app.get("/characters")
def get_characters():
    return list(CHARACTERS.values())


@app.get("/characters/{character_id}")
def get_character(character_id: str):
    character = CHARACTERS.get(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@app.post("/roll")
def roll(modifier: int = 0):
    return roll_d20(modifier)


@app.post("/roll/advantage")
def roll_advantage(modifier: int = 0):
    return roll_with_advantage(modifier)


@app.post("/roll/disadvantage")
def roll_disadvantage(modifier: int = 0):
    return roll_with_disadvantage(modifier)


@app.post("/skill-check")
def check_skill(request: SkillCheckRequest):
    character = CHARACTERS.get(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    stat_map = {
        "perception": "wisdom", "insight": "wisdom", "medicine": "wisdom",
        "investigation": "intelligence", "arcana": "intelligence", "history": "intelligence",
        "persuasion": "charisma", "deception": "charisma", "intimidation": "charisma",
        "stealth": "dexterity", "acrobatics": "dexterity",
        "athletics": "strength",
        "survival": "wisdom",
    }

    stat = stat_map.get(request.skill, "wisdom")
    modifier = stat_modifier(character[stat])
    has_advantage = request.skill in character.get("advantage_skills", [])

    if has_advantage:
        result = roll_with_advantage(modifier)
    else:
        result = skill_check(modifier, request.dc)

    result["skill"] = request.skill
    result["character"] = character["name"]
    return result


@app.post("/combat/attack")
def combat_attack(request: AttackRequest):
    character = CHARACTERS.get(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return attack_roll(request.attack_modifier, request.target_ac)


# --- Scene endpoints ---

class ChoiceRequest(BaseModel):
    character_id: str
    choice_id: int


@app.get("/scenes")
def get_all_scenes():
    return [{"id": s["id"], "scene_number": s["scene_number"], "title": s["title"]} for s in SCENES.values()]


@app.get("/scenes/{scene_number}")
def get_scene(scene_number: int):
    scene = SCENES.get(scene_number)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@app.post("/scenes/{scene_number}/choice")
def make_choice(scene_number: int, request: ChoiceRequest):
    scene = SCENES.get(scene_number)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    character = CHARACTERS.get(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    choice = next((c for c in scene["choices"] if c["id"] == request.choice_id), None)
    if not choice:
        raise HTTPException(status_code=404, detail="Choice not found")

    stat_map = {
        "perception": "wisdom", "insight": "wisdom", "medicine": "wisdom", "survival": "wisdom",
        "investigation": "intelligence", "arcana": "intelligence", "history": "intelligence",
        "persuasion": "charisma", "deception": "charisma", "intimidation": "charisma",
        "stealth": "dexterity", "acrobatics": "dexterity",
        "athletics": "strength",
        "initiative": "dexterity",
    }

    stat = stat_map.get(choice["skill"], "wisdom")
    modifier = stat_modifier(character[stat])
    roll_result = skill_check(modifier, choice["dc"])

    next_scene_number = scene_number + 1
    next_scene = SCENES.get(next_scene_number)

    narrative = _generate_narrative(
        character_name=character["name"],
        choice_text=choice["text"],
        skill=choice["skill"],
        roll=roll_result,
        next_scene=next_scene,
    )

    return {
        "character": character["name"],
        "choice": choice["text"],
        "roll": roll_result,
        "narrative": narrative,
        "next_scene": next_scene_number if next_scene else None,
    }


def _generate_narrative(character_name: str, choice_text: str, skill: str, roll: dict, next_scene: dict | None) -> str:
    success = roll.get("success", False)
    nat = roll.get("natural", 0)

    if nat == 20:
        outcome = f"{character_name} handelt mit meisterhafter Präzision – ein kritischer Erfolg!"
    elif nat == 1:
        outcome = f"Das Schicksal wendet sich gegen {character_name} – ein fataler Fehler."
    elif success:
        outcome = f"{character_name} meistert die Herausforderung."
    else:
        outcome = f"{character_name} scheitert – die Situation wird gefährlicher."

    if next_scene:
        transition = f" Der Weg führt weiter: {next_scene['title']}."
    else:
        transition = " Das Ende von Falkenwacht naht."

    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            return _openai_narrative(api_key, character_name, choice_text, skill, roll, next_scene)
        except Exception:
            pass

    return outcome + transition


def _openai_narrative(api_key: str, character_name: str, choice_text: str, skill: str, roll: dict, next_scene: dict | None) -> str:
    import urllib.request
    import json

    success_text = "erfolgreich" if roll.get("success") else "gescheitert"
    next_title = next_scene["title"] if next_scene else "dem Ende"

    prompt = (
        f"Du bist der Erzähler in Falkenwacht, einem düsteren Fantasy-Abenteuer. "
        f"{character_name} hat '{choice_text}' gewählt. "
        f"Würfelwurf ({skill}): {roll.get('total', 0)} – {success_text}. "
        f"Schreibe 2 atmosphärische Sätze über das Ergebnis und den Übergang zu: {next_title}. "
        f"Nur der Erzählertext, keine Metakommentare."
    )

    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 120,
        "temperature": 0.85,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"].strip()
