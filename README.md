# AI-Powered DnD 5e Guided Narrative Experience

An immersive, dark AI-driven Visual Novel based on D&D 5e core rules. This project focuses on building a deterministic, guided narrative structure that leverages generative AI for atmospheric storytelling while maintaining strict game state management in the backend.

---

## 🚀 Key Architectural & DevOps Highlights
* **Automated CI/CD (GitHub Actions):** Fully automated pipeline that runs backend/frontend linting and automatically deploys the application layers directly to our AWS infrastructure upon every main branch push.
* **Deterministic Backend Rule Engine:** Dice rolls (D20), HP calculations, damage values, and inventory validations are strictly hardcoded in the Python backend. The AI cannot hallucinate or bypass game logic; it only receives validated state payloads to generate context descriptions.
* **Cloud-Native Infrastructure:** Seamlessly hosted within the AWS ecosystem using AWS RDS for PostgreSQL database persistence and EC2/App Runner instances for hosting the application services.

---

## 🛠️ Technology Stack

### Backend
* **Language & Framework:** Python + FastAPI (Asynchronous, lightweight, and optimized for LLM handling)
* **Database:** PostgreSQL (Hosted via AWS RDS)
* **DevOps & Infrastructure:** GitHub Actions (CI/CD), Docker, AWS Services

### Frontend
* **Framework:** React + TailwindCSS
* **Key Components:** Dark-themed Visual Novel UI, Interactive Character Sheet panel, dynamic action logs, and an animated D20 dice-roll window.

---

## 📋 Ticket System & Branch Strategy
Our team follows a strict Ticket-Driven development workflow. All tasks are planned, tracked, and managed via **GitHub Projects (Kanban Board)** to fulfill project requirements. 

To ensure complete environment isolation, team members work exclusively within their assigned feature or devops branches. **Direct commits to `main` are strictly forbidden.** Work is merged into `develop` only after a thorough code review.

### Branch & Ticket Mapping:

* 💾 **main** (Protected Production Branch)
   └── 💾 **develop** (Shared Integration Pool)
        │
        ├── 🌿 `devops/DN-101-ci-cd-pipeline` ── linked to **Ticket DN-101** (Baris Only)
        │    └── *Setup GitHub Actions CI/CD workflows and initial repo setup*
        │
        ├── 🌿 `feat/DN-102-api-setup` ── linked to **Ticket DN-102** (Marcel Only)
        │    └── *Initialize FastAPI skeleton and Database schemas*
        │
        ├── 🌿 `feat/DN-201-rule-engine` ── linked to **Ticket DN-201** (Marcel Only)
        │    └── *Implement core deterministic D20 game mechanics and rules*
        │
        ├── 🌿 `feat/DN-301-visual-novel-ui` ── linked to **Ticket DN-301** (Marcel Only)
        │    └── *Build responsive dark-themed visual novel frontend UI*
        │
        └── 🌿 `devops/DN-302-aws-deployment` ── linked to **Ticket DN-302** (Baris Only)
             └── *Configure production AWS hosting infrastructure*

---

## 📅 Project Roadmap (3-Week Scrum Sprint Plan)

Our team follows a Scrum-based agile workflow, rotating roles (Scrum Master / Product Owner) weekly, managing all tasks through dedicated feature branches linked to project tickets.

### Week 1: Core Architecture & CI/CD Setup [Tickets: DN-101, DN-102]
* Initialize repository, configure GitHub Actions workflows, and orchestrate the baseline AWS connectivity.
* Design PostgreSQL relational database schemas for `Character` sheets and `StoryNode` progress.
* Build the fundamental FastAPI endpoints and implement the core AI API bridge framework.

### Week 2: Game Mechanics & Rule Engine [Ticket: DN-201]
* Implement the core deterministic backend algorithms for D20 skill checks and combat resolution.
* Develop inventory transaction controllers and state-validator interceptors to prevent AI hallucination risks.
* Create secure CRUD API endpoints for saving, loading, and tracking player story flags.

### Week 3: Frontend Integration & Presentation Polish [Tickets: DN-301, DN-302]
* Construct the fully responsive dark Visual Novel visual interface using React and TailwindCSS.
* Bind frontend state handlers to render live character attributes, dynamic HP changes, and dice animations.
* Execute comprehensive end-to-end testing, optimize system performance, and deploy a fully validated core gameplay scenario engineered specifically for the live technical demonstration and final evaluation.
