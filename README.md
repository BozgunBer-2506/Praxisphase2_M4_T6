# Falkenwacht – AI-Powered D&D 5e Visual Novel

A dark, AI-driven Visual Novel built on D&D 5e core rules. The game uses generative AI for storytelling and DM assistance, but all game logic (dice rolls, HP, damage, inventory) is handled strictly in the backend - the AI only receives validated state and generates descriptions.

---

## Key Features

- **Full Combat System** - D20 attack rolls, damage rolls, initiative order, enemy auto-turns via backend
- **AI Dungeon Master** - AWS Bedrock (Claude Haiku) generates scene narration and answers player questions with full game context
- **Save / Load** - Per-user save slots stored in PostgreSQL, restored with full game state (scene, HP, inventory, encounter)
- **Deterministic Rule Engine** - All dice rolls, HP, damage and inventory are computed in Python; AI cannot override game state
- **CI/CD via GitHub Actions** - Automated linting and deployment on every push to main
- **AWS Hosted** - PostgreSQL on RDS, application on EC2, infrastructure managed with Terraform

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Database | PostgreSQL (AWS RDS) |
| Frontend | Next.js 15, React, TailwindCSS |
| AI | AWS Bedrock (Claude Haiku) |
| DevOps | GitHub Actions, Docker, Terraform, AWS ECR/EC2/RDS |

---

## Live

- Frontend: http://18.157.116.245:3000
- API: http://18.157.116.245:8000
- API Docs: http://18.157.116.245:8000/docs

---

## Running Locally

```bash
docker compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## AWS Setup (one-time)

Before the first `terraform apply`, two resources must be created manually in AWS:

**1. S3 Bucket for Terraform State**
- AWS Console → S3 → Create bucket
- Name: `falkenwacht-t6-terraform-state`
- Region: `eu-central-1`

**2. EC2 Key Pair**
- AWS Console → EC2 → Key Pairs → Create key pair
- Name: `falkenwacht-key`
- Store the downloaded `.pem` file as GitHub Secret `SSH_PRIVATE_KEY`

Then in `terraform/`:
```bash
terraform init
terraform apply -var="db_password=YOUR_PASSWORD"
```

**Required GitHub Secrets**

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `DB_PASSWORD` | PostgreSQL database password |
| `SSH_PRIVATE_KEY` | Contents of the `.pem` file (EC2 Key Pair) |

---

## Projektbeschreibung (DE)

Eine KI-gestutzte Visual Novel auf Basis des D&D-5e-Regelwerks. Das Spiel tragt den Namen **Falkenwacht** und nutzt generative KI fur atmospharische Texte und DM-Unterstutzung, wahrend die gesamte Spiellogik (Wurde, HP, Schaden, Inventar) deterministisch im Python-Backend verarbeitet wird.

### Spielsystem

- Zwei spielbare Charaktere: Ryu Watanabe (Samurai) und Ayane (Klerikerin)
- Vollstandiges Kampfsystem mit Initiative, Angriffswurfen, Schadenswurfen und Gegnerzugen
- Speichersystem mit eigenem Slot pro Benutzer, wiederherstellbar mit vollem Spielstand
- KI-DM-Chat fur Regelfragen und narrative Unterstutzung (AWS Bedrock)
- 6 verschiedene Nachkampf-Zustande je nach uberlebenden HP

### Technologiestack

| Bereich | Technologie |
|---------|-------------|
| Backend | Python, FastAPI |
| Datenbank | PostgreSQL (AWS RDS) |
| Frontend | Next.js 15, React, TailwindCSS |
| KI | AWS Bedrock (Anthropic Claude Haiku) |
| DevOps | GitHub Actions, Docker, Terraform, AWS |

### Projektzeitplan

**Woche 1 - DN-101, DN-102**
- Repository-Setup, CI/CD-Pipeline, AWS-Anbindung
- PostgreSQL-Schema fur Charaktere und Story-Knoten
- FastAPI-Grundstruktur und KI-Schnittstelle

**Woche 2 - DN-201, DN-202, DN-203**
- W20-Wurde, Kampfsystem und Inventarverwaltung
- Story-Flags und Zustandsvalidierung
- Docker-Setup und Terraform-Infrastrukturkonfiguration
- Save/Load-Endpunkte und AWS Bedrock-Anbindung

**Woche 3 - DN-301, DN-302, DN-303**
- React-Frontend mit Dark-Theme Visual Novel UI
- Vollstandiges Kampfsystem-Frontend (Initiative, Angriff, Schaden, Gegnerzug)
- Charakterbogen-Panel, Wurfelanimation, HP-Anzeige
- AWS-Deployment und Abschlussprasentation
