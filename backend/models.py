from sqlalchemy import Column, Integer, String, JSON
from database import Base


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
