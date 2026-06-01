# Backend Mini Test Plan

Stand: 2026-06-01

Ziel: Die vorhandene FastAPI-Grundstruktur soll mit kleinen, schnellen Tests abgesichert werden, bevor Speicherstaende, AI-DM-Anbindung und DnD-Regellogik erweitert werden.

## Testumfang fuer die Grundstruktur

### Health

- `GET /health` antwortet mit HTTP 200.
- Bei erreichbarer Datenbank meldet die Response `status: ok`.
- Der Test nutzt eine Fake-DB-Verbindung, damit er ohne Docker stabil laeuft.

### Characters

- `GET /characters` liefert mindestens Ayane und Johan.
- `GET /characters/ayane` liefert Ayane.
- Unbekannte Character-IDs liefern HTTP 404.

### Dice

- `POST /roll?modifier=2` liefert die Felder `roll`, `modifier`, `total`, `nat20`, `nat1`.
- `total` entspricht `roll + modifier`.
- Die Dice-Funktionen sind ueber injizierte Roller deterministisch testbar.
- Vorteil/Nachteil waehlen korrekt den hoeheren bzw. niedrigeren Wurf.
- Skillchecks behandeln Natural 20 als Erfolg und Natural 1 als Fehlschlag.
- Attack Rolls behandeln Treffer, Fehlschlag und kritische Treffer.
- Ungueltige DC-/AC-Werte werden abgelehnt.
- `POST /combat/resolve` liefert Angriff, Schaden und HP-Resultat.
- Schaden wird nur bei Treffern berechnet, kritische Treffer verdoppeln die Schadenswuerfel.
- HP faellt nie unter 0 und `defeated` wird bei 0 HP gesetzt.
- `POST /combat/initiative` liefert eine sortierte Initiative-Reihenfolge.
- Initiative sortiert nach Totalwert und nutzt den Dexterity-Modifier als Tie-Breaker.
- `POST /combat/state/start` erstellt einen einfachen Rundenstatus mit aktiver Runde, Turn-Index, aktiver Figur und HP-Zustand.
- `POST /combat/state/next` wechselt zum naechsten aktiven Teilnehmer und erhoeht bei Rundenwechsel die Rundenzahl.

### Saves

- `POST /saves` erstellt einen Speicherstand fuer einen bekannten Charakter.
- `GET /saves` listet vorhandene Slots ohne kompletten State.
- `GET /saves/{slot_name}` laedt denselben Speicherstand wieder.
- `DELETE /saves/{slot_name}` loescht einen Slot.
- Der Speicherstand enthaelt `main_character`, optionalen `npc_companion`, `story_flags` und `inventory`.
- Unbekannte Szenen werden beim Speichern mit HTTP 404 abgelehnt.
- Unbekannte Speicherstaende liefern beim Laden HTTP 404.
- Ein abweichender `state.main_character.character_id` wird mit HTTP 422 abgelehnt.
- Die automatisierten Tests nutzen SQLite im Speicher, damit sie ohne Docker stabil laufen.

### AI-DM

- `POST /ai-dm/narrate` liefert Erzaehlertext.
- Validierte Regeln werden als `visible_rules_result` unveraendert zurueckgegeben.
- `state_locked` ist `true`, damit klar ist: Die AI darf keine Spielwerte schreiben.
- Prompt-Tests sichern ab, dass HP, Wuerfe, Schaden, Gegnerstatus, Inventory und Savegame-State nicht von der AI veraendert werden duerfen.
- API-Tests sichern ab, dass Gegnerstatus als Kontext an die AI-DM-Schicht uebergeben wird, waehrend `visible_rules_result` unveraendert bleibt.
- Fallback-Tests sichern ab, dass API-Fehler und JSON-/Code-Ausgaben der AI nicht in die Spielantwort durchgereicht werden.
- HUD-Event-Tests sichern ab, dass sichtbare Skill-, Attack-, Damage- und HP-Anzeigeereignisse aus Backend-Regelresultaten entstehen.
- Architekturpruefung: `main.py` delegiert AI-DM-Aufrufe an `backend/ai_dm.py` und enthaelt keine eigene direkte OpenAI-Request-Logik.

### Inventory

- `GET /inventory/catalog` liefert definierte Items mit erlaubten Aktionen.
- `POST /inventory/view` reichert Savegame-Inventory mit Backend-Metadaten, Effekten und erlaubten Aktionen an.
- `POST /inventory/action` validiert `use`, `equip`, `unequip` und `drop` backendseitig und gibt neuen State plus Events zurueck.
- `POST /saves/{slot_name}/inventory/action` fuehrt dieselbe Aktion auf einem Save-Slot aus und persistiert den neuen State.
- Unbekannte Items bekommen keine erlaubten Aktionen, bis sie im Backend-Katalog definiert sind.

## Bewusst noch nicht getestet

- PostgreSQL-Migrationen, weil aktuell `Base.metadata.create_all` fuer die Grundstruktur reicht.
- Charakter- und Szenen-Persistenz, weil diese Daten aktuell noch aus Python-Dateien kommen.
- Echter OpenAI-API-Call, weil automatisierte Tests offline und ohne Secret laufen sollen.
- Vollstaendige Combat-Rundenlogik mit Aktionen pro Runde, Gegner-KI und Persistenz laufender Encounter.
- Erweiterte Item-Effekte jenseits von Heilung, Equipment-Status und Drop.
