# AI-Powered DnD 5e Guided Narrative Experience

A dark, AI-driven Visual Novel built on D&D 5e core rules. The game uses generative AI for storytelling, but all game logic (dice rolls, HP, damage, inventory) is handled strictly in the backend - the AI only receives validated state and generates descriptions.

---

## Key Features

- **CI/CD via GitHub Actions** - automated linting and deployment on every push to main
- **Deterministic Rule Engine** - D20 rolls, HP, damage, and inventory are hardcoded in Python; AI cannot override game state
- **AWS Hosted** - PostgreSQL on RDS, application on EC2 / App Runner

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Database | PostgreSQL (AWS RDS) |
| Frontend | React, TailwindCSS |
| DevOps | GitHub Actions, Docker, AWS |

---

## Project Roadmap

### Week 1 - DN-101, DN-102
- Repo setup, GitHub Actions workflows, AWS connectivity
- PostgreSQL schema for characters and story nodes
- FastAPI base structure and AI bridge

### Week 2 - DN-201, DN-202
- D20 skill checks and combat logic
- Inventory management and state validation
- Save/load endpoints for story progress
- Docker containerization and environment configuration (dev/prod)

### Week 3 - DN-301, DN-302
- React frontend with dark visual novel UI
- Character sheet panel, HP tracking, dice animation
- End-to-end testing and AWS deployment

---

## Projektbeschreibung (DE)

Eine KI-gestutzte Visual Novel auf Basis der D&D-5e-Regelwerks. Das Spiel nutzt generative KI fur atmospharische Texte, wahrend die gesamte Spiellogik (Wurfe, HP, Schaden, Inventar) deterministisch im Python-Backend verarbeitet wird. Die KI erhalt ausschliesslich validierte Zustandsdaten und kann die Spielregeln nicht umgehen.

### Technologien
- **Backend:** Python, FastAPI
- **Datenbank:** PostgreSQL (AWS RDS)
- **Frontend:** React, TailwindCSS
- **DevOps:** GitHub Actions, Docker, AWS

### Projektzeitraum - 3-Wochen-Sprint

**Woche 1** - Repository-Setup, CI/CD-Pipeline, Datenbankschema, FastAPI-Grundstruktur

**Woche 2** - Regelwerk-Engine: W20-Wurfe, Kampfsystem, Inventarverwaltung, Story-Flags, Docker-Setup und Umgebungskonfiguration

**Woche 3** - React-Frontend mit Dark-Theme, Charakterbogen-Panel, Wurfelanimation, AWS-Deployment und Abschlussprasentation
