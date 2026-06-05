from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)

    save_games = relationship("SaveGame", back_populates="user")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    character_class = Column(String, nullable=False)
    race = Column(String, nullable=False)
    hp = Column(Integer, nullable=False)
    max_hp = Column(Integer, nullable=False)
    armor_class = Column(Integer, nullable=False)
    strength = Column(Integer, nullable=False)
    dexterity = Column(Integer, nullable=False)
    constitution = Column(Integer, nullable=False)
    intelligence = Column(Integer, nullable=False)
    wisdom = Column(Integer, nullable=False)
    charisma = Column(Integer, nullable=False)


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True)
    scene_number = Column(Integer, nullable=False, unique=True)
    title = Column(String, nullable=False)
    narrative = Column(String, nullable=False)
    choices = Column(JSON, nullable=False)


class SaveGame(Base):
    __tablename__ = "save_games"

    id = Column(Integer, primary_key=True)
    slot_name = Column(String, nullable=False, unique=True)
    character_id = Column(String, nullable=False)
    scene_number = Column(Integer, nullable=False)
    state = Column(JSON, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="save_games")
    encounters = relationship("Encounter", back_populates="save_game")


class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(Integer, primary_key=True)
    save_game_id = Column(Integer, ForeignKey("save_games.id"), nullable=False)
    round_number = Column(Integer, nullable=False)
    turn_index = Column(Integer, nullable=False)
    active_participant_id = Column(String, nullable=True)
    combat_finished = Column(Boolean, nullable=False, default=False)
    participants = Column(JSON, nullable=False)
    initiative_order = Column(JSON, nullable=False)

    save_game = relationship("SaveGame", back_populates="encounters")
    turn_logs = relationship("EncounterTurnLog", back_populates="encounter")


class EncounterTurnLog(Base):
    __tablename__ = "encounter_turn_logs"

    id = Column(Integer, primary_key=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=False)
    actor_id = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    action_type = Column(String, nullable=False)
    rules_result = Column(JSON, nullable=False)
    hud_events = Column(JSON, nullable=False)
    turn_events = Column(JSON, nullable=False)

    encounter = relationship("Encounter", back_populates="turn_logs")
