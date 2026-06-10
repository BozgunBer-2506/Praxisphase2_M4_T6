from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.orm import Session

from auth import create_access_token, decode_token, hash_password, verify_password
from ai_dm import build_ai_dm_help_response, build_hud_events, generate_ai_dm_narration
from characters import CHARACTERS
from combat import (
    advance_turn,
    create_combat_state,
    resolve_encounter_damage_roll,
    resolve_auto_turn,
    resolve_encounter_turn,
    resolve_enemy_turn,
    resolve_player_attack_roll,
    resolve_player_turn,
)
from database import Base, engine, get_db
from encounter_persistence import create_encounter_turn_log, upsert_encounter_from_save_state
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
from models import Encounter, EncounterTurnLog, SaveGame, User


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    yield


app = FastAPI(title="DnD Visual Novel API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = decode_token(token)
    if not payload:
        return None
    return db.query(User).filter(User.id == int(payload["sub"])).first()


@app.post("/auth/register", status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(username=request.username, hashed_password=hash_password(request.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "token": create_access_token(user.id, user.username)}


@app.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"id": user.id, "username": user.username, "token": create_access_token(user.id, user.username)}


@app.get("/auth/me")
def me(current_user: User | None = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"id": current_user.id, "username": current_user.username}


def build_frontend_encounter_state(
    state: dict,
    hud_events: list[dict],
    rules_result: dict | None = None,
) -> dict:
    participants_by_id = {
        participant["participant_id"]: participant for participant in state.get("participants", [])
    }

    def actor_view(participant_id: str, initiative_entry: dict | None = None) -> dict:
        participant = participants_by_id.get(participant_id, {"participant_id": participant_id})
        return {
            "id": participant_id,
            "participantId": participant_id,
            "name": _participant_display_name(participant_id, participant),
            "kind": _participant_kind(participant.get("side")),
            "side": participant.get("side"),
            "currentHp": participant.get("current_hp"),
            "maxHp": participant.get("max_hp"),
            "ac": participant.get("armor_class"),
            "speed": participant.get("speed", 30),
            "defeated": participant.get("defeated", False),
            "total": initiative_entry.get("total") if initiative_entry else None,
            "roll": initiative_entry.get("roll") if initiative_entry else None,
            "modifier": initiative_entry.get("modifier") if initiative_entry else None,
            "nat20": initiative_entry.get("nat20") if initiative_entry else False,
            "nat1": initiative_entry.get("nat1") if initiative_entry else False,
        }

    initiative_order = [
        actor_view(entry["participant_id"], entry) for entry in state.get("initiative_order", [])
    ]
    participants = [
        actor_view(participant["participant_id"]) for participant in state.get("participants", [])
    ]
    heroes = [
        participant for participant in participants if participant.get("side") == "heroes"
    ]
    enemies = [
        participant for participant in participants if participant.get("side") == "enemies"
    ]
    active_actor_id = state.get("active_participant_id")
    active_actor = actor_view(active_actor_id) if active_actor_id else None

    return {
        "round": state.get("round_number"),
        "turnIndex": state.get("turn_index"),
        "activeActorId": active_actor_id,
        "activeActor": active_actor,
        "initiativeOrder": initiative_order,
        "participants": participants,
        "heroes": heroes,
        "enemies": enemies,
        "combatFinished": state.get("combat_finished", False),
        "pendingDamage": state.get("pending_damage"),
        "turnControl": build_frontend_turn_control(
            active_actor,
            heroes,
            enemies,
            state.get("pending_damage"),
        ),
        "hudEvents": hud_events,
        "lastBackendEvents": hud_events,
        "lastResolution": build_frontend_resolution(rules_result),
    }


def build_frontend_turn_control(
    active_actor: dict | None,
    heroes: list[dict],
    enemies: list[dict],
    pending_damage: dict | None = None,
) -> dict:
    if pending_damage:
        return {
            "requiresPlayerAction": True,
            "requiresDamageRoll": True,
            "autoResolvable": False,
            "allowedActions": ["damage_roll"],
            "availableTargets": [],
        }

    if not active_actor or active_actor.get("defeated"):
        return {
            "requiresPlayerAction": False,
            "requiresDamageRoll": False,
            "autoResolvable": False,
            "allowedActions": [],
            "availableTargets": [],
        }

    active_side = active_actor.get("side")
    if active_side == "heroes":
        return {
            "requiresPlayerAction": True,
            "requiresDamageRoll": False,
            "autoResolvable": False,
            "allowedActions": ["attack"],
            "availableTargets": [enemy for enemy in enemies if not enemy.get("defeated")],
        }
    if active_side == "enemies":
        return {
            "requiresPlayerAction": False,
            "requiresDamageRoll": False,
            "autoResolvable": True,
            "allowedActions": [],
            "availableTargets": [hero for hero in heroes if not hero.get("defeated")],
        }

    return {
        "requiresPlayerAction": False,
        "requiresDamageRoll": False,
        "autoResolvable": False,
        "allowedActions": [],
        "availableTargets": [],
    }


def build_frontend_resolution(rules_result: dict | None) -> dict | None:
    if not rules_result:
        return None

    attack = rules_result.get("attack")
    damage = rules_result.get("damage")
    hp = rules_result.get("hp")

    return {
        "actorId": rules_result.get("actor_id"),
        "targetId": rules_result.get("target_id"),
        "combatFinished": rules_result.get("combat_finished", False),
        "attack": {
            "roll": attack.get("roll"),
            "modifier": attack.get("modifier"),
            "total": attack.get("total"),
            "targetAc": attack.get("target_ac"),
            "hit": attack.get("hit"),
            "critical": attack.get("critical", False),
            "nat20": attack.get("nat20", False),
            "nat1": attack.get("nat1", False),
        }
        if attack
        else None,
        "damage": {
            "rolls": damage.get("rolls", []),
            "modifier": damage.get("modifier"),
            "total": damage.get("total"),
            "critical": damage.get("critical", False),
        }
        if damage
        else None,
        "hp": {
            "previousHp": hp.get("previous_hp"),
            "damage": hp.get("damage"),
            "remainingHp": hp.get("remaining_hp"),
            "defeated": hp.get("defeated", False),
        }
        if hp
        else None,
    }


def _participant_display_name(participant_id: str, participant: dict) -> str:
    if participant_id in CHARACTERS:
        return CHARACTERS[participant_id]["name"]
    return participant.get("name") or participant_id.replace("-", " ").replace("_", " ").title()


def _participant_kind(side: str | None) -> str:
    if side == "heroes":
        return "player"
    if side == "enemies":
        return "enemy"
    return "unknown"


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
    armor_class: int | None = Field(default=None, ge=1)
    attack: dict | None = None

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
    armor_class: int | None = Field(default=None, ge=1)
    attack: dict | None = None


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
    pending_damage: dict | None = None


class EncounterAttackAction(BaseModel):
    action_type: str = Field(pattern="^attack$")
    actor_id: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    attack_modifier: int
    target_ac: int = Field(ge=1)
    damage_dice_count: int = Field(ge=1)
    damage_die_sides: int = Field(ge=1)
    damage_modifier: int = 0


class EncounterPlayerAction(BaseModel):
    action_type: str = Field(pattern="^attack$")
    actor_id: str = Field(min_length=1)
    target_id: str = Field(min_length=1)


class EncounterTurnResolveRequest(BaseModel):
    state: CombatState
    action: EncounterAttackAction


class SaveEncounterTurnResolveRequest(BaseModel):
    action: EncounterAttackAction


class EncounterPlayerTurnResolveRequest(BaseModel):
    state: CombatState
    action: EncounterPlayerAction


class SaveEncounterPlayerTurnResolveRequest(BaseModel):
    action: EncounterPlayerAction


class EncounterAutoTurnResolveRequest(BaseModel):
    state: CombatState
    action: EncounterPlayerAction | None = None


class SaveEncounterAutoTurnResolveRequest(BaseModel):
    action: EncounterPlayerAction | None = None


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


class AiDmHelpRequest(BaseModel):
    message: str = Field(min_length=1)
    slot_name: str | None = None
    scene_context: dict = Field(default_factory=dict)
    rules_result: dict = Field(default_factory=dict)
    character_state: dict = Field(default_factory=dict)
    inventory: list[dict] = Field(default_factory=list)


class AiDmHelpResponse(BaseModel):
    command: str
    answer: str
    topics: list[str]
    state_locked: bool
    allowed_scope: list[str]


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
    encounter: CombatState | None = None


class SaveGameRequest(BaseModel):
    slot_name: str = Field(min_length=1)
    character_id: str
    scene_number: int = Field(ge=1)
    state: SaveGameState


class SaveGameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slot_name: str
    character_id: str
    scene_number: int
    state: SaveGameState


class SaveGameSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


@app.post("/encounter/turn/resolve")
def encounter_turn_resolve(request: EncounterTurnResolveRequest):
    try:
        result = resolve_encounter_turn(
            state=request.state.model_dump(),
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        **result,
        "hud_events": build_hud_events(result["rules_result"]),
    }


@app.post("/encounter/enemy-turn/resolve")
def encounter_enemy_turn_resolve(state: CombatState):
    try:
        result = resolve_enemy_turn(state=state.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        **result,
        "hud_events": build_hud_events(result["rules_result"]),
    }


@app.post("/encounter/player-turn/resolve")
def encounter_player_turn_resolve(request: EncounterPlayerTurnResolveRequest):
    try:
        result = resolve_player_turn(
            state=request.state.model_dump(),
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        **result,
        "hud_events": build_hud_events(result["rules_result"]),
    }


@app.post("/encounter/attack-roll/resolve")
def encounter_attack_roll_resolve(request: EncounterPlayerTurnResolveRequest):
    try:
        result = resolve_player_attack_roll(
            state=request.state.model_dump(),
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    hud_events = build_hud_events(result["rules_result"])
    return {
        **result,
        "hud_events": hud_events,
        "frontend_state": build_frontend_encounter_state(result["state"], hud_events, result["rules_result"]),
    }


@app.post("/encounter/damage-roll/resolve")
def encounter_damage_roll_resolve(state: CombatState):
    try:
        result = resolve_encounter_damage_roll(state=state.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    hud_events = build_hud_events(result["rules_result"])
    return {
        **result,
        "hud_events": hud_events,
        "frontend_state": build_frontend_encounter_state(result["state"], hud_events, result["rules_result"]),
    }


@app.post("/encounter/auto-turn/resolve")
def encounter_auto_turn_resolve(request: EncounterAutoTurnResolveRequest):
    try:
        result = resolve_auto_turn(
            state=request.state.model_dump(),
            action=request.action.model_dump() if request.action else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    hud_events = build_hud_events(result["rules_result"])
    return {
        **result,
        "hud_events": hud_events,
        "frontend_state": build_frontend_encounter_state(result["state"], hud_events, result["rules_result"]),
    }


@app.post("/saves/{slot_name}/encounter/turn/resolve")
def save_encounter_turn_resolve(
    slot_name: str,
    request: SaveEncounterTurnResolveRequest,
    db: Session = Depends(get_db),
):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_encounter_turn(
            state=encounter_state,
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result)
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
        "frontend_state": build_frontend_encounter_state(
            result["state"],
            persisted_result["hud_events"],
            result["rules_result"],
        ),
    }


@app.post("/saves/{slot_name}/encounter/auto-turn/resolve")
def save_encounter_auto_turn_resolve(
    slot_name: str,
    request: SaveEncounterAutoTurnResolveRequest,
    db: Session = Depends(get_db),
):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_auto_turn(
            state=encounter_state,
            action=request.action.model_dump() if request.action else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result)
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
        "frontend_state": build_frontend_encounter_state(
            result["state"],
            persisted_result["hud_events"],
            result["rules_result"],
        ),
    }


@app.post("/saves/{slot_name}/encounter/attack-roll/resolve")
def save_encounter_attack_roll_resolve(
    slot_name: str,
    request: SaveEncounterPlayerTurnResolveRequest,
    db: Session = Depends(get_db),
):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_player_attack_roll(
            state=encounter_state,
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result, action_type="attack_roll")
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
        "frontend_state": build_frontend_encounter_state(
            result["state"],
            persisted_result["hud_events"],
            result["rules_result"],
        ),
    }


@app.post("/saves/{slot_name}/encounter/damage-roll/resolve")
def save_encounter_damage_roll_resolve(
    slot_name: str,
    db: Session = Depends(get_db),
):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_encounter_damage_roll(state=encounter_state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result, action_type="damage_roll")
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
        "frontend_state": build_frontend_encounter_state(
            result["state"],
            persisted_result["hud_events"],
            result["rules_result"],
        ),
    }


@app.post("/saves/{slot_name}/encounter/player-turn/resolve")
def save_encounter_player_turn_resolve(
    slot_name: str,
    request: SaveEncounterPlayerTurnResolveRequest,
    db: Session = Depends(get_db),
):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_player_turn(
            state=encounter_state,
            action=request.action.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result)
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
    }


@app.post("/saves/{slot_name}/encounter/enemy-turn/resolve")
def save_encounter_enemy_turn_resolve(slot_name: str, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")
    encounter_state = save_game.state.get("encounter")
    if not encounter_state:
        raise HTTPException(status_code=422, detail="Save game has no active encounter")

    try:
        result = resolve_enemy_turn(state=encounter_state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    next_save_state = dict(save_game.state)
    next_save_state["encounter"] = result["state"]
    save_game.state = next_save_state
    flag_modified(save_game, "state")
    persisted_result = {**result, "hud_events": build_hud_events(result["rules_result"])}
    encounter = upsert_encounter_from_save_state(db, save_game)
    if encounter:
        create_encounter_turn_log(db, encounter, persisted_result)
    db.commit()
    db.refresh(save_game)
    return {
        "slot_name": save_game.slot_name,
        "state": save_game.state,
        "rules_result": result["rules_result"],
        "turn_events": result["turn_events"],
        "hud_events": persisted_result["hud_events"],
    }


@app.get("/saves/{slot_name}/encounter/persisted")
def get_persisted_encounter(slot_name: str, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")

    encounter = (
        db.query(Encounter)
        .filter(Encounter.save_game_id == save_game.id)
        .order_by(Encounter.id.desc())
        .first()
    )
    if not encounter:
        raise HTTPException(status_code=404, detail="Persisted encounter not found")

    return {
        "slot_name": save_game.slot_name,
        "encounter": {
            "id": encounter.id,
            "round_number": encounter.round_number,
            "turn_index": encounter.turn_index,
            "active_participant_id": encounter.active_participant_id,
            "combat_finished": encounter.combat_finished,
            "participants": encounter.participants,
            "initiative_order": encounter.initiative_order,
        },
    }


@app.get("/saves/{slot_name}/encounter/turn-logs")
def get_persisted_encounter_turn_logs(slot_name: str, db: Session = Depends(get_db)):
    save_game = db.query(SaveGame).filter(SaveGame.slot_name == slot_name).first()
    if not save_game:
        raise HTTPException(status_code=404, detail="Save game not found")

    encounter = (
        db.query(Encounter)
        .filter(Encounter.save_game_id == save_game.id)
        .order_by(Encounter.id.desc())
        .first()
    )
    if not encounter:
        raise HTTPException(status_code=404, detail="Persisted encounter not found")

    turn_logs = (
        db.query(EncounterTurnLog)
        .filter(EncounterTurnLog.encounter_id == encounter.id)
        .order_by(EncounterTurnLog.id)
        .all()
    )
    return {
        "slot_name": save_game.slot_name,
        "encounter_id": encounter.id,
        "turn_logs": [
            {
                "id": turn_log.id,
                "actor_id": turn_log.actor_id,
                "target_id": turn_log.target_id,
                "action_type": turn_log.action_type,
                "rules_result": turn_log.rules_result,
                "hud_events": turn_log.hud_events,
                "turn_events": turn_log.turn_events,
            }
            for turn_log in turn_logs
        ],
    }


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


@app.post("/ai-dm/help", response_model=AiDmHelpResponse)
def ai_dm_help(request: AiDmHelpRequest, db: Session = Depends(get_db)):
    scene_context = dict(request.scene_context)
    character_state = dict(request.character_state)
    inventory = list(request.inventory)
    if request.slot_name:
        save_game = db.query(SaveGame).filter(SaveGame.slot_name == request.slot_name).first()
        if not save_game:
            raise HTTPException(status_code=404, detail="Save game not found")
        scene = SCENES.get(save_game.scene_number)
        if scene:
            scene_context = {
                "scene_number": scene["scene_number"],
                "title": scene["title"],
                "narrative": scene.get("narrative"),
            }
        character_state = save_game.state.get("main_character", character_state)
        inventory = save_game.state.get("inventory", inventory)

    return build_ai_dm_help_response(
        message=request.message,
        scene_context=scene_context,
        rules_result=request.rules_result,
        character_state=character_state,
        inventory=inventory,
    )


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
    flag_modified(save_game, "state")
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
        new_state = request.state.model_dump()
        existing_encounter = (save_game.state or {}).get("encounter")
        new_encounter = new_state.get("encounter")
        if existing_encounter and not existing_encounter.get("combat_finished", True):
            if new_encounter is None:
                new_state["encounter"] = existing_encounter
            elif not new_encounter.get("pending_damage") and existing_encounter.get("pending_damage"):
                new_state["encounter"] = {**new_encounter, "pending_damage": existing_encounter["pending_damage"]}
        save_game.state = new_state
        flag_modified(save_game, "state")
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
    try:
        upsert_encounter_from_save_state(db, save_game)
        db.commit()
        db.refresh(save_game)
    except Exception:
        db.rollback()
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

    encounters = db.query(Encounter).filter(Encounter.save_game_id == save_game.id).all()
    for encounter in encounters:
        db.query(EncounterTurnLog).filter(EncounterTurnLog.encounter_id == encounter.id).delete()
        db.delete(encounter)
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
