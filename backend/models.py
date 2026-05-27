from sqlalchemy import Column, Integer, String, Boolean
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
