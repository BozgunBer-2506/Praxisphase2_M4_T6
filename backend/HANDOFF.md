# Backend Handoff

Stand: 2026-06-04

Branch: `develop`

## Zweistufiger Combat-Vertrag

Ziel: Attack Roll und Damage Roll werden getrennt abgebildet. Das Backend bleibt Source of Truth fuer Treffer, Schaden, HP-Aenderungen und HUD-Events. Das Frontend zeigt nur an und sendet Spieleraktionen.

## Neuer Ablauf fuer den Frontend Combat-MVP

### 1. Attack Roll

Save-State Route:

```text
POST /saves/{slot_name}/encounter/attack-roll/resolve
```

Nicht-persistente Route:

```text
POST /encounter/attack-roll/resolve
```

Request:

```json
{
  "action": {
    "action_type": "attack",
    "actor_id": "ayane",
    "target_id": "bandit"
  }
}
```

Backend-Verhalten:

- Validiert aktiven Actor und Target.
- Liest Attack-Bonus, Target-AC und Damage-Daten aus dem Backend-State.
- Fuehrt nur den Attack Roll aus.
- Aendert noch keine HP.
- Gibt `attack.hit`, `attack.critical`, `attack.nat20`, `attack.nat1` und sichtbare `hud_events` zurueck.
- Bei Hit wird `state.encounter.pending_damage` gespeichert.
- Bei Miss wird kein Damage erlaubt und der Turn weitergeschoben.

### 2. Damage Roll

Save-State Route:

```text
POST /saves/{slot_name}/encounter/damage-roll/resolve
```

Nicht-persistente Route:

```text
POST /encounter/damage-roll/resolve
```

Request fuer Save-State Route:

```json
{}
```

Backend-Verhalten:

- Erlaubt Damage nur, wenn `pending_damage` existiert.
- Wuerfelt Damage backendseitig.
- Berechnet HP-Aenderung backendseitig.
- Loescht `pending_damage`.
- Schiebt danach den Turn weiter.
- Gibt `damage`, `hp` und sichtbare `hud_events` zurueck.

## Frontend-State Felder

`frontend_state.pendingDamage`:

- `null`, wenn kein Damage-Step offen ist.
- Objekt mit `actor_id`, `target_id`, Damage-Dice-Daten und `critical`, wenn nach einem Hit Damage offen ist.

`frontend_state.turnControl` bei offenem Damage-Step:

```json
{
  "requiresPlayerAction": true,
  "requiresDamageRoll": true,
  "autoResolvable": false,
  "allowedActions": ["damage_roll"],
  "availableTargets": []
}
```

Das Frontend darf in diesem Zustand keinen neuen Attack Roll starten.

## Bestehende Legacy-Routen

Diese Routen existieren weiterhin und fuehren Attack und Damage noch gemeinsam aus:

- `POST /combat/resolve`
- `POST /encounter/turn/resolve`
- `POST /encounter/player-turn/resolve`
- `POST /encounter/enemy-turn/resolve`
- `POST /encounter/auto-turn/resolve`
- `POST /saves/{slot_name}/encounter/turn/resolve`
- `POST /saves/{slot_name}/encounter/player-turn/resolve`
- `POST /saves/{slot_name}/encounter/enemy-turn/resolve`
- `POST /saves/{slot_name}/encounter/auto-turn/resolve`

Fuer den neuen Frontend Combat-MVP sollen bevorzugt die zweistufigen Save-Routen genutzt werden.

## Tests

Abgesichert sind:

- Attack Roll erzeugt bei Hit `pending_damage`, ohne HP zu aendern.
- Miss erzeugt kein `pending_damage` und schiebt den Turn weiter.
- Damage Roll ist nur mit `pending_damage` erlaubt.
- Damage Roll aendert HP und loescht `pending_damage`.
- Save-State speichert `pending_damage` nach Attack Roll.
- Save-State verbraucht `pending_damage` nach Damage Roll.
- Encounter-Turn-Logs speichern getrennt `attack_roll` und `damage_roll`.
