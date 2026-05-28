SCENES = {
    1: {
        "id": 1,
        "scene_number": 1,
        "title": "Der alte Gang",
        "narrative": (
            "Der alte Gang atmet kalte Luft. Hinter der versiegelten Tür "
            "pulsiert ein Licht, als würde es auf deinen Namen warten. "
            "Schatten flüstern an den Wänden von Falkenwacht."
        ),
        "choices": [
            {
                "id": 1,
                "text": "Die Fackel heben und den Gang untersuchen",
                "skill": "perception",
                "dc": 12,
            },
            {
                "id": 2,
                "text": "Mit der fremden Stimme verhandeln",
                "skill": "persuasion",
                "dc": 14,
            },
            {
                "id": 3,
                "text": "Waffe ziehen und Initiative würfeln",
                "skill": "initiative",
                "dc": 10,
            },
        ],
    },
    2: {
        "id": 2,
        "scene_number": 2,
        "title": "Das versiegelte Zimmer",
        "narrative": (
            "Du betrittst das Zimmer. Staub liegt schwer in der Luft. "
            "In der Ecke glänzt ein alter Schlüssel – doch die Stille hier "
            "fühlt sich falsch an. Etwas beobachtet dich."
        ),
        "choices": [
            {
                "id": 1,
                "text": "Den Schlüssel nehmen",
                "skill": "stealth",
                "dc": 13,
            },
            {
                "id": 2,
                "text": "Den Raum auf Fallen prüfen",
                "skill": "investigation",
                "dc": 15,
            },
            {
                "id": 3,
                "text": "Sofort den Raum verlassen",
                "skill": "athletics",
                "dc": 8,
            },
        ],
    },
    3: {
        "id": 3,
        "scene_number": 3,
        "title": "Die Wächter von Falkenwacht",
        "narrative": (
            "Zwei Wächter blockieren den Weg zum Turm. "
            "Ihre Rüstungen tragen das Zeichen des alten Ordens. "
            "Sie kennen dich – aber als Freund oder Feind?"
        ),
        "choices": [
            {
                "id": 1,
                "text": "Das Ordenszeichen zeigen",
                "skill": "persuasion",
                "dc": 12,
            },
            {
                "id": 2,
                "text": "Im Schatten schleichen",
                "skill": "stealth",
                "dc": 16,
            },
            {
                "id": 3,
                "text": "Den Kampf suchen",
                "skill": "athletics",
                "dc": 14,
            },
        ],
    },
}
