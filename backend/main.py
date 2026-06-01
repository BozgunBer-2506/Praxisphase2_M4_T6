from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from ai_dm import build_hud_events, generate_ai_dm_narration
from characters import CHARACTERS
from combat import advance_turn, create_combat_state
from database import Base, engine, get_db
from inventory import apply_inventory_action, build_inventory_view, list_item_catalog
from scenes import SCENES
from dice import (
    attack_roll,
    build_initiative_order,
    resolve_attack,
    roll_d20,
    roll_with_advantage,
    roll_with_disadvantage,
    skill_check,
    stat_modifier,
)
from models import SaveGame


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    yield


app = FastAPI(title="DnD Visual Novel API", lifespan=lifespan)


class SkillCheckRequest(BaseModel):
    character_id: str
    skill: str
    dc: int = Field(ge=1)


class AttackRequest(BaseModel):
    character_id: str
    attack_modifier: int
    target_ac: int = Field(ge=1)


class CombatResolveRequest(BaseModel):
    character_id: str
    attack_modifier: int
    target_ac: int = Field(ge=1)
    damage_dice_count: int = Field(ge=1)
    damage_die_sides: int = Field(ge=1)
    damage_modifier: int = 0
    target_current_hp: int = Field(ge=0)


class InitiativeParticipantRequest(BaseModel):
    participant_id: str = Field(min_length=1)
    dexterity_modifier: int


class InitiativeRequest(BaseModel):
    participants: list[InitiativeParticipantRequest] = Field(min_length=1)


class CombatParticipantRequest(BaseModel):
    participant_id: str = Field(min_length=1)
    side: str = Field(min_length=1)
    dexterity_modifier: int
    current_hp: int = Field(ge=0)
    max_hp: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_hp(self):
        if self.current_hp > self.max_hp:
            raise ValueError("current_hp must be less than or equal to max_hp")
        return self


class CombatStateStartRequest(BaseModel):
    participants: list[CombatParticipantRequest] = Field(min_length=1)


class CombatParticipantState(BaseModel):
    participant_id: str
    side: str
    current_hp: int = Field(ge=0)
    max_hp: int = Field(gt=0)
    defeated: bool


class InitiativeEntryResponse(BaseModel):
    participant_id: str
    roll: int
    modifier: int
    total: int
    nat20: bool
    nat1: bool


class CombatState(BaseModel):
    round_number: int = Field(ge=1)
    turn_index: int = Field(ge=0)
    active_participant_id: str | None
    initiative_order: list[InitiativeEntryResponse] = Field(min_length=1)
    participants: list[CombatParticipantState] = Field(min_length=1)
    combat_finished: bool


class AiDmNarrationRequest(BaseModel):
    scene_title: str = Field(min_length=1)
    player_choice: str = Field(min_length=1)
    rules_result: dict
    character_state: dict
    enemies: list[dict] = Field(default_factory=list)
    inventory: list[dict] = Field(default_factory=list)


class AiDmNarrationResponse(BaseModel):
    narration: str
    visible_rules_result: dict
    hud_events: list[dict]
    state_locked: bool


class InventoryItem(BaseModel):
    item_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    quantity: int = Field(default=1, ge=1)
    equipped: bool = False


class RuntimeCharacterState(BaseModel):
    character_id: str
    current_hp: int = Field(ge=0)
    max_hp: int = Field(gt=0)
    conditions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_hp(self):
        if self.current_hp > self.max_hp:
            raise ValueError("current_hp must be less than or equal to max_hp")
        return self


class SaveGameState(BaseModel):
    main_character: RuntimeCharacterState
    npc_companion: RuntimeCharacterState | None = None
    story_flags: dict[str, bool] = Field(default_factory=dict)
    inventory: list[InventoryItem] = Field(default_factory=list)


class SaveGameRequest(BaseModel):
    slot_name: str = Field(min_length=1)
    character_id: str
    scene_number: int = Field(ge=1)
    state: SaveGameState


class SaveGameResponse(BaseModel):
    id: int
    slot_name: str
    character_id: str
    scene_number: int
    state: SaveGameState


class SaveGameSummaryResponse(BaseModel):
    id: int
    slot_name: str
    character_id: str
    scene_number: int


class InventoryViewRequest(BaseModel):
    inventory: list[InventoryItem] = Field(default_factory=list)


class InventoryActionRequest(BaseModel):
    state: SaveGameState
    item_id: str = Field(min_length=1)
    action: str = Field(pattern="^(use|equip|unequip|drop)$")


class SaveInventoryActionRequest(BaseModel):
    item_id: str = Field(min_length=1)
    action: str = Field(pattern="^(use|equip|unequip|drop)$")


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


@app.post("/combat/resolve")
def combat_resolve(request: CombatResolveRequest):
    character = CHARACTERS.get(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return resolve_attack(
        attack_modifier=request.attack_modifier,
        target_ac=request.target_ac,
        damage_dice_count=request.damage_dice_count,
        damage_die_sides=request.damage_die_sides,
        damage_modifier=request.damage_modifier,
        target_current_hp=request.target_current_hp,
    )


@app.post("/combat/initiative")
def combat_initiative(request: InitiativeRequest):
    participants = [participant.model_dump() for participant in request.participants]
    return {"order": build_initiative_order(participants)}


@app.post("/combat/state/start", response_model=CombatState)
def combat_state_start(request: CombatStateStartRequest):
    participants = [participant.model_dump() for participant in request.participants]
    initiative_participants = [
        {
            "participant_id": participant["participant_id"],
            "dexterity_modifier": participant["dexterity_modifier"],
        }
        for participant in participants
    ]
    initiative_order = build_initiative_order(initiative_participants)
    return create_combat_state(participants, initiative_order)


@app.post("/combat/state/next", response_model=CombatState)
def combat_state_next(state: CombatState):
    return advance_turn(state.model_dump())


@app.post("/ai-dm/narrate", response_model=AiDmNarrationResponse)
def ai_dm_narrate(request: AiDmNarrationRequest):
    narration = generate_ai_dm_narration(
        scene_title=request.scene_title,
        player_choice=request.player_choice,
        rules_result=request.rules_result,
        character_state=request.character_state,
        enemies=request.enemies,
        inventory=request.inventory,
    )
    return {
        "narration": narration,
        "visible_rules_result": request.rules_result,
        "hud_events": build_hud_events(request.rules_result),
        "state_locked": True,
    }


@app.get("/inventory/catalog")
def inventory_catalog():
    return list_item_catalog()


@app.post("/inventory/view")
def inventory_view(request: InventoryViewRequest):
    return {"items": build_inventory_view([item.model_dump() for item in request.inventory])}


@app.post("/inventory/action")
def inventory_action(request: InventoryActionRequest):
    try:
        return apply_inventory_action(
            state=request.state.model_dump(),
            item_id=request.item_id,
            action=request.action,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/saves/{slot_name}/inventory/action")
def save_inventory_action(slot_name: str, request: SaveInventoryActionRequest, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")

    try:
        result = apply_inventory_action(
            state=save_game.state,
            item_id=request.item_id,
            action=request.action,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    save_game.state = result["state"]
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "inventory": result["inventory"],
        "events": result["events"],
    }


@app.post("/saves", response_model=SaveGameResponse)
def create_or_update_save(request: SaveGameRequest, db: Session = Depends(get_db)):
    character = CHARACTERS.get(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    if request.state.main_character.character_id != request.character_id:
        raise HTTPException(status_code=422, detail="Main character must match character_id")
    if request.state.main_character.character_id not in CHARACTERS:
        raise HTTPException(status_code=404, detail="Main character not found")
    if request.state.npc_companion and request.state.npc_companion.character_id not in CHARACTERS:
        raise HTTPException(status_code=404, detail="NPC companion not found")
    if request.scene_number not in SCENES:
        raise HTTPException(status_code=404, detail="Scene not found")

    save_game = db.query(SaveGame).filter(SaveGame.slot_name == request.slot_name).first()
    if save_game:
        save_game.character_id = request.character_id
        save_game.scene_number = request.scene_number
        save_game.state = request.state.model_dump()
    else:
        save_game = SaveGame(
            slot_name=request.slot_name,
            character_id=request.character_id,
            scene_number=request.scene_number,
            state=request.state.model_dump(),
        )
        db.add(save_game)

    db.commit()
    db.refresh(save_game)
    return save_game


@app.get("/saves", response_model=list[SaveGameSummaryResponse])
def list_saves(db: Session = Depends(get_db)):
    return db.query(SaveGame).order_by(SaveGame.id).all()


@app.get("/saves/{slot_name}", response_model=SaveGameResponse)
def get_save(slot_name: str, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    return save_game


@app.delete("/saves/{slot_name}")
def delete_save(slot_name: str, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")

    db.delete(save_game)
    db.commit()
    return {"status": "deleted", "slot_name": slot_name}


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
    nat = roll.get("roll", 0)

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

    ai_text = generate_ai_dm_narration(
        scene_title=next_scene["title"] if next_scene else "Falkenwacht",
        player_choice=choice_text,
        rules_result={"skill": skill, **roll},
        character_state={"name": character_name},
        inventory=[],
    )
    return f"{outcome + transition} {ai_text}"
