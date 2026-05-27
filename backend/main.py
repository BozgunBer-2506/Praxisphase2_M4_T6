from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from database import engine
from characters import CHARACTERS
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
