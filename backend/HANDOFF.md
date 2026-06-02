# Backend Handoff

Stand: 2026-06-01

Branch: `backend-grundstruktur`

Kein Push auf `main`. Der Branch basiert lokal auf `origin/develop`.

## Kontext

Das Backend liegt im Repo unter `backend/`. Der vorhandene Docker-Aufbau aus dem Repo wird weiterverwendet:

- `docker-compose.yml` im Repo-Root
- `backend/Dockerfile`
- Backend-Port lokal: `8000`
- Frontend-Port laut Baris-Test: `3000`

Baris hat laut Screenshot Swagger UI und Deployment bereits erfolgreich getestet. Der externe Demo-Link war:

```text
http://18.157.116.245:3000
```

Hinweis: Wenn der Link aktuell nicht erreichbar ist, ist die AWS-Instanz vermutlich gestoppt. Das ist kein lokaler Backend-Fehler, sondern ein Deployment-/Infra-Thema fuer den DevOps-Chat.

## Fertig im Backend

- FastAPI-Grundstruktur mit Healthcheck
- Docker-kompatibler Backend-Start ueber vorhandenes Compose-Setup
- Savegame-API mit JSON-State
- DnD-Wuerfel- und Combat-Basislogik
- AI-DM-Schicht in `ai_dm.py`
- AI-DM darf nur Erzaehlertext erzeugen
- HP, Wuerfe, Treffer, Schaden, Inventory und Savegame-State bleiben Backend-kontrolliert
- Sichtbare `hud_events` fuer spaeteres Dice-/Damage-HUD
- Inventory-Katalog und Inventory-View
- Inventory-Actions `use`, `equip`, `unequip`, `drop`
- Persistente Inventory-Actions direkt auf Save-Slots

## Wichtige Endpunkte

- `GET /health`
- `GET /characters`
- `POST /roll`
- `POST /skill-check`
- `POST /combat/resolve`
- `POST /combat/initiative`
- `POST /combat/state/start`
- `POST /combat/state/next`
- `POST /ai-dm/narrate`
- `GET /inventory/catalog`
- `POST /inventory/view`
- `POST /inventory/action`
- `POST /saves`
- `GET /saves`
- `GET /saves/{slot_name}`
- `DELETE /saves/{slot_name}`
- `POST /saves/{slot_name}/inventory/action`

Details stehen in `API_OVERVIEW.md`.

## Tests

Letzter lokaler Stand:

```text
58 passed
```

Geprueft wurde:

- lokale Pytest-Suite
- `compileall`
- Docker Compose Backend-Rebuild
- `GET /health`
- AI-DM Narration inklusive `hud_events`
- Inventory-Katalog und Inventory-View
- Inventory-Action auf State
- persistente Inventory-Action auf Save-Slot

Testdetails stehen in `TEST_PLAN.md`.

## Docker Start

Aus dem Repo-Root:

```powershell
docker compose up -d db backend
```

Backend lokal:

```text
http://127.0.0.1:8000
```

Swagger UI lokal:

```text
http://127.0.0.1:8000/docs
```

## Naechste Backend-Schritte

1. Vollstaendige Combat-Rundenlogik mit Aktionen pro Runde.
2. Gegner-KI / Enemy Turn Resolver.
3. Persistente Encounter statt nur uebergebenem Combat-State.
4. Erweiterte Item-Effekte jenseits von Heilung, Equipment-Status und Drop.
5. Spaeter: echte DB-Migrationen statt `Base.metadata.create_all`.

## Chat-Zuordnung

- Frontend HUD und Inventory-Sheet: Frontend Chat
- AWS, CI/CD, gestoppte Instanz, Deployment-Link: DevOps Chat
- API, Savegames, Regeln, AI-DM, Inventory-Backend: Backend Chat
