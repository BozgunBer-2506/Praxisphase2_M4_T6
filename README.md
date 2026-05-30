# AI-Powered DnD 5e Guided Narrative Experience – Falkenwacht

A dark, AI-driven Visual Novel built on D&D 5e core rules. The game uses generative AI for storytelling, but all game logic (dice rolls, HP, damage, inventory) is handled strictly in the backend - the AI only receives validated state and generates descriptions.

---

## Key Features

- **CI/CD via GitHub Actions** - automated linting and deployment on every push to main
- **Deterministic Rule Engine** - D20 rolls, HP, damage, and inventory are hardcoded in Python; AI cannot override game state
- **AWS Hosted** - PostgreSQL on RDS, application on Elastic Beanstalk, infrastructure managed with Terraform

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Database | PostgreSQL (AWS RDS) |
| Frontend | Next.js, React, TailwindCSS, Zustand, Framer Motion |
| DevOps | GitHub Actions, Docker, Terraform, AWS |

## AWS Setup (einmalig / one-time)

Vor dem ersten `terraform apply` müssen zwei Ressourcen manuell in AWS erstellt werden:

**1. S3 Bucket für Terraform State**
- AWS Console → S3 → Create bucket
- Name: `falkenwacht-terraform-state`
- Region: `eu-central-1`

**2. EC2 Key Pair**
- AWS Console → EC2 → Key Pairs → Create key pair
- Name: `falkenwacht-key`
- Die heruntergeladene `.pem`-Datei als GitHub Secret `SSH_PRIVATE_KEY` hinterlegen

Danach in `terraform/` ausführen:
```bash
terraform init
terraform apply -var="db_password=DEIN_PASSWORT"
```

**Benötigte GitHub Secrets**

| Secret | Beschreibung |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS Zugangsdaten |
| `AWS_SECRET_ACCESS_KEY` | AWS Zugangsdaten |
| `DB_PASSWORD` | PostgreSQL Datenbankpasswort |
| `SSH_PRIVATE_KEY` | Inhalt der `.pem` Datei (EC2 Key Pair) |

---

## Running Locally

Make sure Docker is installed, then:

```bash
docker compose up
```

- Backend: http://localhost:8000
- Health check: http://localhost:8000/health
- Database: localhost:5432

## Project Roadmap

### Week 1 - DN-101, DN-102
- Repo setup, GitHub Actions workflows, AWS connectivity
- PostgreSQL schema for characters and story nodes
- FastAPI base structure and AI bridge

### Week 2 - DN-201, DN-202, DN-203
- D20 skill checks and combat logic
- Inventory management and state validation
- Save/load endpoints for story progress
- Docker containerization and Terraform infrastructure setup
- Story/Scene endpoints and OpenAI narrative integration

### Week 3 - DN-301, DN-302
- React frontend with dark visual novel UI
- Character sheet panel, HP tracking, dice animation
- End-to-end testing and AWS deployment

---

## Projektbeschreibung (DE)

Eine KI-gestützte Visual Novel auf Basis des D&D-5e-Regelwerks. Das Spiel trägt den Namen **Falkenwacht** und nutzt generative KI für atmosphärische Texte, während die gesamte Spiellogik (Würfe, HP, Schaden, Inventar) deterministisch im Python-Backend verarbeitet wird. Die KI erhält ausschließlich validierte Zustandsdaten und kann die Spielregeln nicht umgehen.

## Technologiestack

| Bereich | Technologie |
|---------|-------------|
| Backend | Python, FastAPI |
| Datenbank | PostgreSQL (AWS RDS) |
| Frontend | Next.js, React, TailwindCSS, Zustand, Framer Motion |
| DevOps | GitHub Actions, Docker, Terraform, AWS |

## Projektzeitplan

### Woche 1 - DN-101, DN-102
- Repository-Setup, CI/CD-Pipeline, AWS-Anbindung
- PostgreSQL-Schema für Charaktere und Story-Knoten
- FastAPI-Grundstruktur und KI-Schnittstelle

### Woche 2 - DN-201, DN-202, DN-203
- W20-Würfe, Kampfsystem und Inventarverwaltung
- Story-Flags und Zustandsvalidierung
- Docker-Setup und Terraform-Infrastrukturkonfiguration
- Story/Scene-Endpunkte und OpenAI-Narrative-Anbindung

### Woche 3 - DN-301, DN-302
- React-Frontend mit Dark-Theme Visual Novel UI
- Charakterbogen-Panel, Würfelanimation, HP-Anzeige
- AWS-Deployment und Abschlusspräsentation
