# Backend API Overview

Stand: 2026-05-31

Diese Datei dokumentiert den aktuell vorhandenen Backend-Stand fuer die spaetere Frontend-Anbindung.

## Lokaler Start

Aus dem Repo-Root:

```powershell
docker compose up -d db backend
```

Backend-URL:

```text
http://127.0.0.1:8000
```

## Health

### GET /health

Prueft FastAPI und Datenbankverbindung.

Erwartete Antwort bei laufendem Docker-Setup:

```json
{
  "status": "ok",
  "database": "ok"
}
```

## Charaktere

### GET /characters

Liefert alle aktuell fest hinterlegten Charaktere.

Aktuelle Charakter-Slugs fuer weitere Requests:

- `ayane`
- `johan`

Wichtig: Die Response enthaelt aktuell zusaetzlich numerische Felder wie `id: 1`, aber Detailrouten und Skillchecks erwarten die Slugs `ayane` oder `johan`.

### GET /characters/{character_id}

Beispiel:

```text
GET /characters/ayane
```

## Wuerfel und Checks

### POST /roll?modifier=2

Fuehrt einen einfachen W20-Wurf mit Modifier aus.

### POST /roll/advantage?modifier=2

Fuehrt einen W20-Wurf mit Vorteil aus.

### POST /roll/disadvantage?modifier=2

Fuehrt einen W20-Wurf mit Nachteil aus.

### POST /skill-check

Beispiel-Request:

```json
{
  "character_id": "ayane",
  "skill": "insight",
  "dc": 12
}
```

`dc` muss mindestens `1` sein. Natural 20 gilt als Erfolg, Natural 1 als Fehlschlag.

### POST /combat/attack

Beispiel-Request:

```json
{
  "character_id": "ayane",
  "attack_modifier": 5,
  "target_ac": 14
}
```

`target_ac` muss mindestens `1` sein. Natural 20 trifft kritisch, Natural 1 trifft nicht.

### POST /combat/resolve

Fuehrt einen Angriff inklusive Schaden und HP-Reduktion aus. Die AI darf diese Werte nicht setzen; sie kann nur das validierte Ergebnis beschreiben.

Beispiel-Request:

```json
{
  "character_id": "ayane",
  "attack_modifier": 5,
  "target_ac": 14,
  "damage_dice_count": 1,
  "damage_die_sides": 8,
  "damage_modifier": 3,
  "target_current_hp": 20
}
```

Beispiel-Antwort:

```json
{
  "attack": {
    "roll": 12,
    "modifier": 5,
    "total": 17,
    "nat20": false,
    "nat1": false,
    "target_ac": 14,
    "hit": true,
    "critical": false
  },
  "damage": {
    "dice_count": 1,
    "die_sides": 8,
    "modifier": 3,
    "critical": false,
    "rolls": [6],
    "total": 9
  },
  "hp": {
    "previous_hp": 20,
    "damage": 9,
    "remaining_hp": 11,
    "defeated": false
  }
}
```

### POST /combat/initiative

Berechnet die Initiative-Reihenfolge fuer eine Kampfsituation. Sortierung: hoechster Totalwert zuerst, bei Gleichstand hoeherer Dexterity-Modifier zuerst.

Beispiel-Request:

```json
{
  "participants": [
    {
      "participant_id": "ayane",
      "dexterity_modifier": 2
    },
    {
      "participant_id": "johan",
      "dexterity_modifier": 0
    }
  ]
}
```

Beispiel-Antwort:

```json
{
  "order": [
    {
      "participant_id": "ayane",
      "roll": 14,
      "modifier": 2,
      "total": 16,
      "nat20": false,
      "nat1": false
    }
  ]
}
```

### POST /combat/state/start

Erstellt einen einfachen Combat-Rundenstatus mit Initiative-Reihenfolge, aktiver Runde, aktivem Teilnehmer und HP-Zustand aller Teilnehmer.

Beispiel-Request:

```json
{
  "participants": [
    {
      "participant_id": "ayane",
      "side": "heroes",
      "dexterity_modifier": 2,
      "current_hp": 28,
      "max_hp": 28
    },
    {
      "participant_id": "bandit",
      "side": "enemies",
      "dexterity_modifier": 1,
      "current_hp": 11,
      "max_hp": 11
    }
  ]
}
```

### POST /combat/state/next

Nimmt einen Combat-State entgegen und gibt den naechsten aktiven Teilnehmer zurueck. Besiegte Teilnehmer werden uebersprungen, beim Zurueckspringen auf den ersten Teilnehmer wird `round_number` erhoeht.

## AI-DM

### POST /ai-dm/narrate

Erzeugt Erzaehlertext zu einem bereits vom Backend validierten Regelergebnis.
Die AI darf keine Spielwerte setzen oder veraendern. HP, Wuerfe, Treffer, Schaden, Inventory, Items und Savegame-State bleiben Backend-Werte.
Das Feld `visible_rules_result` wird unveraendert zurueckgegeben, damit das Frontend spaeter ein sichtbares Dice-/Damage-HUD bauen kann.
Das Feld `hud_events` liefert zusaetzlich bereits strukturierte Anzeige-Ereignisse fuer Skill Checks, Attack Rolls, Damage und HP-Aenderungen.
Der Kontext enthaelt Szene, Spielerentscheidung, Charakterstatus, Gegnerstatus und Inventory, damit die AI atmosphaerisch reagieren kann, ohne Spielwerte zu schreiben.
Wenn kein API-Key vorhanden ist, die AI-Anfrage fehlschlaegt oder die AI JSON/Code statt Erzaehlertext liefert, nutzt das Backend einen lokalen Fallback-Erzaehlertext.
Alle AI-DM-Aufrufe laufen zentral ueber `backend/ai_dm.py`; `main.py` enthaelt keine eigene direkte OpenAI-Request-Logik mehr.

Beispiel-Request:

```json
{
  "scene_title": "Warehouse",
  "player_choice": "Attack the bandit",
  "rules_result": {
    "attack": {
      "hit": true
    },
    "damage": {
      "total": 7
    },
    "hp": {
      "remaining_hp": 4
    }
  },
  "character_state": {
    "character_id": "ayane",
    "current_hp": 28
  },
  "enemies": [
    {
      "enemy_id": "bandit",
      "current_hp": 4,
      "max_hp": 11
    }
  ],
  "inventory": [
    {
      "item_id": "torch",
      "name": "Torch",
      "quantity": 1
    }
  ]
}
```

Beispiel-Antwort:

```json
{
  "narration": "Warehouse: Attack the bandit. Die Entscheidung zeigt Wirkung, und der Weg oeffnet sich einen Schritt weiter.",
  "visible_rules_result": {
    "attack": {
      "hit": true
    },
    "damage": {
      "total": 7
    },
    "hp": {
      "remaining_hp": 4
    }
  },
  "hud_events": [
    {
      "type": "attack_roll",
      "label": "Attack Roll",
      "payload": {
        "hit": true
      }
    },
    {
      "type": "damage",
      "label": "Damage",
      "payload": {
        "total": 7
      }
    },
    {
      "type": "hp_change",
      "label": "HP",
      "payload": {
        "remaining_hp": 4
      }
    }
  ],
  "state_locked": true
}
```

Frontend-Hinweis fuer spaeter:

- Dice-/Hit-/Damage-Werte sollen im Frontend sichtbar angezeigt werden, nicht DM-only verdeckt.
- Inventory-Daten sollen aus Backend-State kommen und im Frontend spaeter als ausklappbares, klickbares Inventory-Sheet dargestellt werden.
- Usable Items und equipbare Items brauchen spaeter eigene Backend-Actions, bevor das Frontend sie ausfuehrt.

## Inventory

### GET /inventory/catalog

Liefert den Backend-Item-Katalog inklusive erlaubter Aktionen und Effekte. Dieser Endpunkt fuehrt noch keine Aktion aus.

Beispiel-Antwort:

```json
[
  {
    "item_id": "healing_potion",
    "name": "Healing Potion",
    "category": "consumable",
    "description": "Restores a small amount of HP when used.",
    "actions": ["use", "drop"],
    "effect": {
      "heal": {
        "dice_count": 2,
        "die_sides": 4,
        "modifier": 2
      }
    }
  }
]
```

### POST /inventory/view

Reichert ein Inventory aus dem Savegame-State mit Backend-Metadaten an, damit das Frontend spaeter klickbare Items darstellen kann.

Beispiel-Request:

```json
{
  "inventory": [
    {
      "item_id": "leather_armor",
      "name": "Leather Armor",
      "quantity": 1
    }
  ]
}
```

Beispiel-Antwort:

```json
{
  "items": [
    {
      "item_id": "leather_armor",
      "name": "Leather Armor",
      "category": "armor",
      "description": "Light armor with base AC 11 plus dexterity modifier.",
      "actions": ["equip", "unequip", "drop"],
      "equipment_slot": "armor",
      "effect": {
        "armor_class": {
          "base": 11,
          "dexterity_modifier": true
        }
      },
      "quantity": 1,
      "equipped": false
    }
  ]
}
```

### POST /inventory/action

Fuehrt eine validierte Inventory-Aktion auf einem uebergebenen Savegame-State aus. Das Backend entscheidet, ob `use`, `equip`, `unequip` oder `drop` erlaubt ist, und gibt den neuen State plus sichtbare Events zurueck.
Healing Potion nutzt echte DnD-5e-Heilung `2d4+2`. HP-Aenderungen fuer Schaden und Heilung werden ausschliesslich backendseitig berechnet und validiert.

Beispiel-Request:

```json
{
  "item_id": "healing_potion",
  "action": "use",
  "state": {
    "main_character": {
      "character_id": "ayane",
      "current_hp": 10,
      "max_hp": 28
    },
    "story_flags": {},
    "inventory": [
      {
        "item_id": "healing_potion",
        "name": "Healing Potion",
        "quantity": 1
      }
    ]
  }
}
```

Beispiel-Antwort:

```json
{
  "state": {
    "main_character": {
      "character_id": "ayane",
      "current_hp": 20,
      "max_hp": 28,
      "conditions": []
    },
    "story_flags": {},
    "inventory": []
  },
  "inventory": [],
  "events": [
    {
      "type": "inventory_use",
      "item_id": "healing_potion"
    },
    {
      "type": "hp_change",
      "item_id": "healing_potion",
      "payload": {
        "previous_hp": 10,
        "remaining_hp": 17,
        "healing": {
          "dice_count": 2,
          "die_sides": 4,
          "modifier": 2,
          "rolls": [1, 4],
          "total": 7
        }
      }
    }
  ]
}
```

### POST /saves/{slot_name}/inventory/action

Fuehrt dieselbe validierte Inventory-Aktion direkt auf einem gespeicherten Slot aus und persistiert den neuen State.
Auch hier werden Healing Rolls und HP-Aenderungen im Backend berechnet; das Frontend sendet nur `item_id` und `action`.

Beispiel:

```text
POST /saves/autosave/inventory/action
```

Beispiel-Request:

```json
{
  "item_id": "healing_potion",
  "action": "use"
}
```

Beispiel-Antwort:

```json
{
  "slot_name": "autosave",
  "state": {
    "main_character": {
      "character_id": "ayane",
      "current_hp": 20,
      "max_hp": 28,
      "conditions": []
    },
    "story_flags": {},
    "inventory": []
  },
  "inventory": [],
  "events": [
    {
      "type": "inventory_use",
      "item_id": "healing_potion"
    }
  ]
}
```

## Szenen

### GET /scenes

Liefert eine Kurzliste der vorhandenen Szenen.

### GET /scenes/{scene_number}

Beispiel:

```text
GET /scenes/1
```

### POST /scenes/{scene_number}/choice

Fuehrt eine Choice fuer eine Szene aus, inklusive Skillcheck und Narrativ.

Beispiel-Request:

```json
{
  "character_id": "ayane",
  "choice_id": 1
}
```

## Speicherstaende

### GET /saves

Liefert eine Liste aller Speicher-Slots ohne kompletten `state`.

Beispiel-Antwort:

```json
[
  {
    "id": 1,
    "slot_name": "autosave",
    "character_id": "ayane",
    "scene_number": 1
  }
]
```

### POST /saves

Erstellt oder aktualisiert einen Speicherstand anhand von `slot_name`.
`character_id` muss ein bekannter Character-Slug sein, aktuell `ayane` oder `johan`.
`scene_number` muss auf eine vorhandene Szene zeigen.
`state.main_character.character_id` muss mit `character_id` uebereinstimmen.

Beispiel-Request:

```json
{
  "slot_name": "autosave",
  "character_id": "ayane",
  "scene_number": 1,
  "state": {
    "main_character": {
      "character_id": "ayane",
      "current_hp": 28,
      "max_hp": 28,
      "conditions": []
    },
    "npc_companion": {
      "character_id": "johan",
      "current_hp": 24,
      "max_hp": 24,
      "conditions": []
    },
    "story_flags": {
      "egg_stolen": true
    },
    "inventory": [
      {
        "item_id": "torch",
        "name": "Torch",
        "quantity": 1
      }
    ]
  }
}
```

### GET /saves/{slot_name}

Liest einen Speicherstand anhand des Slot-Namens.

Beispiel:

```text
GET /saves/autosave
```

### DELETE /saves/{slot_name}

Loescht einen Speicherstand anhand des Slot-Namens.

Beispiel:

```text
DELETE /saves/autosave
```

Antwort:

```json
{
  "status": "deleted",
  "slot_name": "autosave"
}
```

Fehlerfaelle:

- Unbekannter Charakter: HTTP 404 `Character not found`
- Unbekannte Szene: HTTP 404 `Scene not found`
- Unbekannter Speicherstand: HTTP 404 `Save game not found`
- Leerer `slot_name`, negative `scene_number`, ungueltige HP-Werte oder abweichender `state.main_character.character_id`: HTTP 422

## Offene Punkte fuer spaetere Tasks

- Character-ID-Vertrag vereinheitlichen: entweder Slug-Feld sichtbar machen oder numerische IDs auch akzeptieren.
- Text-Encoding in vorhandenen Szenen/Narrativen pruefen, weil Umlaute in API-Antworten aktuell teilweise fehlerhaft dargestellt werden.
- Johan-Klasse mit Projektkanon abgleichen: aktuell `Ranger`, langfristig laut Kanon `Cleric`.
- Charakter- und Szenendaten kommen aktuell noch aus Python-Dateien statt aus PostgreSQL-Tabellen.
- Vollstaendige Kampfregeln fehlen noch: Aktionen pro Runde, Gegner-KI und Persistenz laufender Encounter.
- Inventory-Actions sind als State-Operation und persistente Save-Slot-Operation vorbereitet.
