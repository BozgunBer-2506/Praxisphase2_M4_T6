export type CharacterId = "ryu" | "ayane";

export type SkillCheck = {
  ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  skill?: string;
  dc: number;
};

export type Character = {
  id: CharacterId;
  name: string;
  className: string;
  level: number;
  subclassName: string;
  background: string;
  feats: string[];
  modelImageUrl: string;
  backstory: string;
  roleDescription: string;
  stats: {
    hp: number;
    ac: number;
    initiative: number;
    speed: number;
  };
};

export type Choice = {
  id: string;
  label: string;
  description: string;
  nextSceneId: string;
  failureSceneId?: string;
  natural1SceneId?: string;
  natural20SceneId?: string;
  check?: SkillCheck;
  checks?: SkillCheck[];
};

export type DialogueLine = {
  speaker: string;
  text: string;
};

export type Scene = {
  id: string;
  title: string;
  location: string;
  chapter: string;
  speaker: string;
  narration: string;
  dialogueLines: DialogueLine[];
  imageUrl: string;
  choices: Choice[];
};

export const characters: Record<CharacterId, Character> = {
  ryu: {
    id: "ryu",
    name: "Ryu Watanabe",
    className: "Fighter",
    level: 3,
    subclassName: "Samurai",
    background: "Samurai-Schüler des Watanabe-Clans",
    feats: ["Defensive Haltung", "Waffenmeisterschaft"],
    modelImageUrl: "/characters/ryu-watanabe-model.png",
    backstory:
      "Ryu Watanabe wurde in einer alten Kriegertradition erzogen und trägt Disziplin wie eine zweite Haut. Seit seiner Ankunft in Falkenwacht sucht er nicht nur Aufträge, sondern Antworten auf Spuren, die andere lieber übersehen. Als Samurai bleibt er ruhig, bis der Moment kommt, in dem Zögern gefährlicher ist als Stahl.",
    roleDescription:
      "Ryu kämpft direkt, diszipliniert und entschlossen. Als Hauptcharakter führt er die Gruppe in gefährlichen Situationen an.",
    stats: {
      hp: 31,
      ac: 15,
      initiative: 5,
      speed: 30,
    },
  },
  ayane: {
    id: "ayane",
    name: "Ayane",
    className: "Klerikerin",
    level: 3,
    subclassName: "Domäne des Lichts",
    background: "Akrobatin mit heiligem Eid",
    feats: ["Heilerinstinkt", "Ritualkundige"],
    modelImageUrl: "/characters/ayane-cleric-model.png",
    backstory:
      "Ayane hört auf Zeichen, die andere als Zufall abtun. Ihr Glaube ist kein Schmuck, sondern ein Werkzeug gegen Furcht, Korruption und Lügen. In Falkenwacht erkennt sie früh, dass das gestohlene Ei nicht nur ein politischer Vorfall ist.",
    roleDescription:
      "Ayane handelt bedacht, gläubig und beobachtend. Als Hauptcharakter erkennt sie Zeichen, Motive und verborgene Gefahren schneller.",
    stats: {
      hp: 24,
      ac: 16,
      initiative: 3,
      speed: 30,
    },
  },
};

export const characterSelectionChoices: Choice[] = [
  {
    id: "choose-ryu",
    label: "Ryu Watanabe als Hauptcharakter wählen",
    description:
      "Ryu wird zur spielbaren Hauptfigur. Ayane begleitet ihn als NPC und unterstützt mit klerikalem Wissen.",
    nextSceneId: "prolog-das-gestohlene-ei",
  },
  {
    id: "choose-ayane",
    label: "Ayane als Hauptcharakter wählen",
    description:
      "Ayane wird zur spielbaren Hauptfigur. Ryu begleitet sie als NPC und schützt die Gruppe im Kampf.",
    nextSceneId: "prolog-das-gestohlene-ei",
  },
];

export const scenes: Scene[] = [
  {
    id: "titel-falkenwacht",
    title: "Falkenwacht",
    location: "Greifenstadt Falkenwacht",
    chapter: "Titelbild",
    speaker: "DM",
    imageUrl: "/scenes/falkenwacht-title-city.png",
    narration:
      "Vor euch erhebt sich Falkenwacht, die Greifenstadt. Über nassen Dächern ziehen Schatten ihre Kreise, während Laternenlicht in den Gassen flackert. Etwas in dieser Stadt ist aus dem Gleichgewicht geraten, und noch bevor der erste Auftrag ausgesprochen wird, spürt ihr: Das gestohlene Ei ist nur der Anfang.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Vor euch erhebt sich Falkenwacht, die Greifenstadt. Über nassen Dächern ziehen Schatten ihre Kreise, während Laternenlicht in den Gassen flackert.",
      },
      {
        speaker: "DM",
        text: "Etwas in dieser Stadt ist aus dem Gleichgewicht geraten. Noch bevor der erste Auftrag ausgesprochen wird, spürt ihr: Das gestohlene Ei ist nur der Anfang.",
      },
    ],
    choices: [
      {
        id: "continue-to-character-selection",
        label: "Zur Charakterwahl",
        description:
          "Bestimme, wer die Geschichte als Hauptcharakter beginnt.",
        nextSceneId: "charakterwahl",
      },
    ],
  },
  {
    id: "charakterwahl",
    title: "Charakterwahl",
    location: "Falkenwacht",
    chapter: "Start",
    speaker: "System",
    imageUrl: "/scenes/falkenwacht-title-city.png",
    narration:
      "Wähle deinen Hauptcharakter. Der andere Charakter begleitet dich als NPC und reagiert im Verlauf der Geschichte auf deine Entscheidungen.",
    dialogueLines: [
      {
        speaker: "System",
        text: "Wähle deinen Hauptcharakter. Der andere Charakter begleitet dich als NPC und reagiert im Verlauf der Geschichte auf deine Entscheidungen.",
      },
    ],
    choices: characterSelectionChoices,
  },
  {
    id: "prolog-das-gestohlene-ei",
    title: "Das gestohlene Ei",
    location: "Falkenwacht",
    chapter: "Prolog",
    speaker: "DM",
    imageUrl: "/scenes/prolog-stolen-egg.png",
    narration:
      "In Falkenwacht verbreitet sich die Nachricht von einem gestohlenen Ei. Was wie ein einfacher Auftrag beginnt, führt tiefer in politische Spannungen, alte Spuren und eine Gefahr, die größer ist als ein Diebstahl.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "In Falkenwacht verbreitet sich die Nachricht von einem gestohlenen Ei.",
      },
      {
        speaker: "DM",
        text: "Was wie ein einfacher Auftrag beginnt, führt tiefer in politische Spannungen, alte Spuren und eine Gefahr, die größer ist als ein Diebstahl.",
      },
    ],
    choices: [
      {
        id: "prolog-start",
        label: "Zur Abenteurergilde Falkenwacht gehen",
        description:
          "Du folgst der Spur zum Ort, an dem neue Aufträge, Gerüchte und gefährliche Wahrheiten zusammenlaufen.",
        nextSceneId: "gilde-varian-thorne",
      },
    ],
  },
  {
    id: "gilde-varian-thorne",
    title: "Varian Thorne und der Auftrag",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "Varian Thorne",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Varian Thorne erwartet dich in der Abenteurergilde. Seine Stimme bleibt ruhig, doch die Anspannung im Raum ist deutlich zu spüren.",
    dialogueLines: [
      {
        speaker: "Varian Thorne",
        text: "Ihr seid spät. Oder früh genug... je nachdem, wie ihr sterben wollt.",
      },
      {
        speaker: "DM",
        text: "Er mustert euch einen Moment lang. Seine Augen wandern von einem zum anderen, als würde er eure Seelen wiegen.",
      },
      {
        speaker: "Varian Thorne",
        text: "Setzt euch. Nicht weil ich höflich bin. Sondern weil ihr stehen bleiben würdet, bis euch die Beine einschlafen.",
      },
    ],
    choices: [
      {
        id: "accept-contract",
        label: "Den Auftrag annehmen",
        description:
          "Du nimmst Varians Bitte ernst und erklärst dich bereit, die Suche sofort zu beginnen.",
        nextSceneId: "auftrag-angenommen",
      },
      {
        id: "ask-details",
        label: "Nach Details fragen",
        description:
          "Du willst wissen, wer zuletzt Zugang zum Ei hatte und welche Spuren bereits bekannt sind.",
        nextSceneId: "auftrag-details",
        failureSceneId: "auftrag-details-verpasst",
        natural20SceneId: "auftrag-details-nat20",
        natural1SceneId: "auftrag-details-nat1",
        checks: [
          {
            ability: "INT",
            skill: "Investigation",
            dc: 12,
          },
          {
            ability: "WIS",
            skill: "Perception",
            dc: 12,
          },
        ],
      },
      {
        id: "react-suspiciously",
        label: "Misstrauisch reagieren",
        description:
          "Du beobachtest Varian genauer und prüfst, ob er euch die ganze Wahrheit sagt.",
        nextSceneId: "auftrag-misstrauen",
        failureSceneId: "auftrag-misstrauen-verpasst",
        natural20SceneId: "auftrag-misstrauen-nat20",
        natural1SceneId: "auftrag-misstrauen-nat1",
        check: {
          ability: "WIS",
          skill: "Insight",
          dc: 13,
        },
      },
    ],
  },
  {
    id: "auftrag-angenommen",
    title: "Auftrag angenommen",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "Varian Thorne",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Varian nickt knapp. Kein Lob, kein Dank. Nur das Geräusch von Pergament, das über den Tisch geschoben wird.",
    dialogueLines: [
      {
        speaker: "Varian Thorne",
        text: "Gut. Dann verschwendet keine Zeit. Wer dieses Ei genommen hat, wusste genau, was er damit auslöst.",
      },
      {
        speaker: "DM",
        text: "Auf dem Pergament stehen Namen, Orte und eine grobe Skizze der letzten bekannten Route durch Falkenwacht.",
      },
    ],
    choices: [
      {
        id: "follow-inner-trade-route",
        label: "Der Route durch Falkenwacht folgen",
        description:
          "Du folgst der groben Skizze zur inneren Handelsroute, wo die letzte sichere Spur des Eis endet.",
        nextSceneId: "innere-handelsroute",
      },
    ],
  },
  {
    id: "auftrag-details",
    title: "Varians Details",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "Varian Thorne",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Varian legt zwei Finger auf die Karte, als hätte er diese Frage erwartet.",
    dialogueLines: [
      {
        speaker: "Varian Thorne",
        text: "Zuletzt gesehen wurde das Ei nahe der inneren Handelsroute. Drei Zeugen, zwei Lügen, ein verschwundener Wachmann.",
      },
      {
        speaker: "DM",
        text: "Seine Stimme bleibt ruhig, aber der Griff an seinem Greifenring verrät, dass dieser Auftrag persönlicher ist, als er zugibt.",
      },
    ],
    choices: [
      {
        id: "follow-witness-route",
        label: "Die Zeugenroute verfolgen",
        description:
          "Du nutzt Varians Details und suchst die innere Handelsroute nach ersten Widersprüchen ab.",
        nextSceneId: "innere-handelsroute",
      },
    ],
  },
  {
    id: "auftrag-details-verpasst",
    title: "Unklare Hinweise",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Die Hinweise bleiben bruchstückhaft. Varian gibt euch genug, um zu starten, aber nicht genug, um den wahren Verlauf zu erkennen.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du erkennst einzelne Spuren, doch Varians Angaben bleiben unvollständig. Etwas fehlt.",
      },
      {
        speaker: "Varian Thorne",
        text: "Wenn ihr jedes Detail braucht, werdet ihr zu langsam sein.",
      },
    ],
    choices: [
      {
        id: "accept-after-missed-details",
        label: "Trotzdem aufbrechen",
        description:
          "Du akzeptierst, dass manche Antworten erst auf der Straße gefunden werden.",
        nextSceneId: "auftrag-angenommen",
      },
    ],
  },
  {
    id: "auftrag-details-nat20",
    title: "Perfekte Spur",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Ein winziger Widerspruch in Varians Angaben fällt sofort auf. Die Spur ist klarer, als er beabsichtigt hat.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du erkennst, dass Varian einen Namen verschweigt. Nicht aus Vergesslichkeit, sondern aus Absicht.",
      },
      {
        speaker: "Varian Thorne",
        text: "Ihr seid aufmerksamer, als ich gehofft hatte.",
      },
    ],
    choices: [
      {
        id: "press-varian-after-nat20",
        label: "Varian auf den verschwiegenen Namen festnageln",
        description:
          "Du nutzt den Vorteil und zwingst Varian, mehr preiszugeben.",
        nextSceneId: "auftrag-details",
      },
    ],
  },
  {
    id: "auftrag-details-nat1",
    title: "Falsche Spur",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Ein Detail wirkt wichtig, doch es zieht eure Aufmerksamkeit in die falsche Richtung.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du fokussierst dich auf eine falsche Spur. Varian bemerkt es und lässt dich gewähren.",
      },
      {
        speaker: "Varian Thorne",
        text: "Interessante Theorie. Gefährlich falsch, aber interessant.",
      },
    ],
    choices: [
      {
        id: "recover-after-nat1-details",
        label: "Die Spur neu ordnen",
        description:
          "Du sammelst dich und kehrst zum eigentlichen Auftrag zurück.",
        nextSceneId: "auftrag-angenommen",
      },
    ],
  },
  {
    id: "auftrag-misstrauen",
    title: "Misstrauen gegenüber Varian",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Du achtest nicht nur auf Varians Worte, sondern auf alles, was er auslässt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Varian erzählt genug, um den Auftrag zu beginnen, aber nicht genug, um ihn wirklich zu verstehen.",
      },
      {
        speaker: "Varian Thorne",
        text: "Misstrauen hält euch am Leben. Aber verwechselt es nicht mit Klugheit.",
      },
    ],
    choices: [
      {
        id: "follow-route-with-suspicion",
        label: "Mit Misstrauen zur Handelsroute aufbrechen",
        description:
          "Du behältst Varians Lücken im Kopf und prüfst die Spur selbst.",
        nextSceneId: "innere-handelsroute",
      },
    ],
  },
  {
    id: "auftrag-misstrauen-verpasst",
    title: "Varians Maske bleibt",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Varian bleibt undurchsichtig. Sein Ton ist ruhig, seine Absicht verborgen.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du spürst Druck im Raum, aber nicht, woher er kommt. Varian gibt nichts preis.",
      },
      {
        speaker: "Varian Thorne",
        text: "Misstrauen ohne Beweis ist nur Angst in besserer Kleidung.",
      },
    ],
    choices: [
      {
        id: "accept-after-missed-insight",
        label: "Den Auftrag dennoch annehmen",
        description:
          "Du lässt Varians Geheimnisse vorerst liegen und konzentrierst dich auf das Ei.",
        nextSceneId: "auftrag-angenommen",
      },
    ],
  },
  {
    id: "auftrag-misstrauen-nat20",
    title: "Varians Riss in der Fassade",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Für einen Moment siehst du hinter Varians Kontrolle. Er ist nicht nur besorgt. Er fürchtet, dass ihn die Vergangenheit einholt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du erkennst den kurzen Blick zu seinem Greifenring. Varian verbirgt Schuld, nicht nur Informationen.",
      },
      {
        speaker: "Varian Thorne",
        text: "Fragt nicht nach Dingen, die euch noch nicht töten müssen.",
      },
    ],
    choices: [
      {
        id: "use-insight-nat20",
        label: "Den verborgenen Druck ausnutzen",
        description:
          "Du merkst dir Varians Schwachstelle und spielst vorsichtig weiter.",
        nextSceneId: "auftrag-misstrauen",
      },
    ],
  },
  {
    id: "auftrag-misstrauen-nat1",
    title: "Gefährliche Fehleinschätzung",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/guild-varian-thorne-visible.png",
    narration:
      "Du liest Varian falsch. Seine Ruhe wirkt plötzlich wie Arroganz, und dein Misstrauen geht in die falsche Richtung.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du verwechselst Varians Vorsicht mit Schuld. Der Raum wird kälter.",
      },
      {
        speaker: "Varian Thorne",
        text: "Wenn ihr mich für den Feind haltet, seid ihr für den echten blind.",
      },
    ],
    choices: [
      {
        id: "recover-after-insight-nat1",
        label: "Die Spannung entschärfen",
        description:
          "Du trittst einen Schritt zurück, bevor der Auftrag scheitert, bevor er begonnen hat.",
        nextSceneId: "auftrag-angenommen",
      },
    ],
  },
  {
    id: "innere-handelsroute",
    title: "Die innere Handelsroute",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/inner-trade-route-rain.png",
    narration:
      "Die Handelsroute liegt unter kaltem Regen. Wagenspuren kreuzen sich, Laternen flackern im Wind, und irgendwo zwischen Marktständen und Wachposten endet Varians sichere Information.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Die Skizze führt euch zur inneren Handelsroute. Hier wurde das Ei zuletzt offiziell gesehen.",
      },
      {
        speaker: "DM",
        text: "Zwischen nassem Pflaster, gebrochenen Radspuren und nervösen Blicken liegt die erste echte Spur.",
      },
    ],
    choices: [
      {
        id: "investigate-trade-route",
        label: "Die Radspuren und Wachmarken untersuchen",
        description:
          "Du prüfst, ob die Route manipuliert wurde und welche Spur wirklich zum Ei gehört.",
        nextSceneId: "handelsroute-spur-erkannt",
        failureSceneId: "handelsroute-spur-verloren",
        natural20SceneId: "handelsroute-spur-perfekt",
        natural1SceneId: "handelsroute-spur-falsch",
        checks: [
          {
            ability: "INT",
            skill: "Investigation",
            dc: 13,
          },
          {
            ability: "WIS",
            skill: "Survival",
            dc: 13,
          },
        ],
      },
      {
        id: "question-route-witnesses",
        label: "Zeugen vorsichtig befragen",
        description:
          "Du suchst nach jemandem, der mehr gesehen hat, als er öffentlich sagen will.",
        nextSceneId: "handelsroute-spur-erkannt",
        failureSceneId: "handelsroute-spur-verloren",
        check: {
          ability: "CHA",
          skill: "Persuasion",
          dc: 12,
        },
      },
    ],
  },
  {
    id: "handelsroute-spur-erkannt",
    title: "Eine Spur im Regen",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/inner-trade-route-rain.png",
    narration:
      "Eine Spur löst sich aus dem Chaos. Jemand hat versucht, die Route zu verschleiern, aber nicht gut genug.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du findest Hinweise auf einen Wagen, der die offizielle Route verlassen hat.",
      },
      {
        speaker: "DM",
        text: "Die Spur führt nicht zum Haupttor, sondern tiefer in Richtung Unterstadt.",
      },
    ],
    choices: [
      {
        id: "secure-trade-route-save",
        label: "Speicherstand sichern und Spur markieren",
        description:
          "Du hältst die neue Spur fest. Der nächste Abschnitt führt Richtung Unterstadt.",
        nextSceneId: "hinterhalt-handelsroute",
      },
    ],
  },
  {
    id: "handelsroute-spur-verloren",
    title: "Verwaschene Spuren",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/inner-trade-route-rain.png",
    narration:
      "Der Regen nimmt euch mehr Hinweise, als er offenlegt. Ihr findet genug, um weiterzugehen, aber nicht genug, um sicher zu sein.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Die Spuren verlaufen ineinander. Etwas wurde absichtlich verwischt.",
      },
      {
        speaker: "DM",
        text: "Trotzdem bleibt ein Muster: Die Unterstadt taucht zu oft in den Gerüchten auf.",
      },
    ],
    choices: [
      {
        id: "move-to-understadt-with-risk",
        label: "Trotz unsicherer Spur Richtung Unterstadt gehen",
        description:
          "Du gehst weiter, auch wenn die nächste Szene gefährlicher beginnen könnte.",
        nextSceneId: "hinterhalt-handelsroute",
      },
    ],
  },
  {
    id: "handelsroute-spur-perfekt",
    title: "Die perfekte Fährte",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/inner-trade-route-rain.png",
    narration:
      "Für einen Moment ergibt alles Sinn: die Radspur, die Wachmarke, die Lüge des Zeugen. Die Fährte ist klar.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du erkennst, dass der Wagen absichtlich als Handelslieferung getarnt wurde.",
      },
      {
        speaker: "DM",
        text: "Eine eingeritzte Markierung verweist auf einen alten Zugang zur Unterstadt.",
      },
    ],
    choices: [
      {
        id: "mark-perfect-trail",
        label: "Die Fährte sichern",
        description:
          "Du markierst die saubere Spur und bereitest den nächsten Abschnitt vor.",
        nextSceneId: "hinterhalt-handelsroute",
      },
    ],
  },
  {
    id: "handelsroute-spur-falsch",
    title: "Eine Falle aus Spuren",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1",
    speaker: "DM",
    imageUrl: "/scenes/inner-trade-route-rain.png",
    narration:
      "Die erste Spur wirkt zu klar. Erst zu spät merkst du, dass jemand wollte, dass du genau dorthin schaust.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du folgst einer falschen Markierung. Für einen Moment verlierst du die echte Route.",
      },
      {
        speaker: "DM",
        text: "Doch der Fehler zeigt dir etwas Wichtiges: Jemand schützt den Weg zur Unterstadt aktiv.",
      },
    ],
    choices: [
      {
        id: "recover-false-trail",
        label: "Die falsche Spur korrigieren",
        description:
          "Du ordnest die Hinweise neu und gehst vorsichtiger weiter.",
        nextSceneId: "hinterhalt-handelsroute",
      },
    ],
  },
  {
    id: "hinterhalt-handelsroute",
    title: "Hinterhalt auf der Handelsroute",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Die Spur führt tiefer zwischen Marktständen und nassen Torbögen hindurch. Dann reißt der Regen kurz auf, und Schatten lösen sich aus den Gassen. Der Kampf beginnt nach D&D 5e: Initiative, Bewegung, Aktion, Bonusaktion und Reaktion werden vom Backend ausgewertet.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ein Schattenräuber tritt aus dem Regen. Zwei weitere Silhouetten bewegen sich seitlich durch die Gasse.",
      },
      {
        speaker: "DM",
        text: "Der vordere Gegner bleibt knapp außerhalb der Klingenreichweite stehen. Seine Haltung wirkt nicht hastig, sondern geplant.",
      },
      {
        speaker: "Ayane",
        text: "Ich halte die Linie. Sag mir, wann ich Licht oder Klinge brauche.",
      },
    ],
    choices: [
      {
        id: "combat-ryu-katana",
        label: "Ryu geht in Reichweite und greift mit dem Katana an",
        description:
          "Ryu bewegt sich bis zu 30 ft. zum vorderen Schattenräuber und nutzt seine Aktion für einen Nahkampfangriff.",
        nextSceneId: "kampf-katana-erster-schlag",
      },
      {
        id: "combat-ryu-kunai",
        label: "Ryu bleibt auf Distanz und wirft ein Kunai",
        description:
          "Ryu bleibt außerhalb der direkten Reichweite und nutzt einen Fernkampfangriff mit Kunai.",
        nextSceneId: "kampf-kunai-distanz",
      },
      {
        id: "combat-ayane-companion",
        label: "Ayane handeln lassen",
        description:
          "Der DM entscheidet Ayanes Companion-Aktion nach Lage des Kampfes. Danach würfelst du den geforderten Angriff, Zauber oder Heilwurf.",
        nextSceneId: "kampf-ayane-licht",
      },
      {
        id: "combat-read-enemy",
        label: "Den Gegner lesen und seine Bewegung einschätzen",
        description:
          "Ryu beobachtet Fußarbeit, Abstand und Angriffswinkel, bevor er sich festlegt.",
        nextSceneId: "kampf-gegner-gelesen",
        failureSceneId: "kampf-gegner-nicht-gelesen",
        natural20SceneId: "kampf-gegner-perfekt-gelesen",
        natural1SceneId: "kampf-gegner-falsch-gelesen",
        checks: [
          {
            ability: "WIS",
            skill: "Insight",
            dc: 13,
          },
          {
            ability: "WIS",
            skill: "Perception",
            dc: 13,
          },
        ],
      },
    ],
  },
  {
    id: "kampf-gegner-gelesen",
    title: "Der erste Winkel",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu erkennt den Rhythmus des vorderen Gegners. Der Schattenräuber setzt das Gewicht zu stark auf das linke Bein und will euch in die engere Gasse drängen.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu liest den ersten Bewegungswinkel. Der Gegner will nicht nur angreifen, sondern euch von der offenen Straße trennen.",
      },
      {
        speaker: "Ayane",
        text: "Dann bleiben wir aus der Gasse. Ich decke die Seite.",
      },
    ],
    choices: [
      {
        id: "start-initiative-after-read-success",
        label: "Initiative auswürfeln",
        description:
          "Der Kampf beginnt. Ryu, Ayane und die Gegner würfeln Initiative, bevor die erste Runde festgelegt wird.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-gegner-nicht-gelesen",
    title: "Zu viele Schatten",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Regen, Laternenlicht und schnelle Schritte machen die Bewegung schwer lesbar. Der Gegner bleibt gefährlich unklar.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu erkennt, dass der Gegner erfahren ist, aber nicht, welchen Winkel er zuerst nimmt.",
      },
      {
        speaker: "DM",
        text: "Die Schatten bewegen sich schneller. Jetzt entscheidet die Initiative.",
      },
    ],
    choices: [
      {
        id: "start-initiative-after-read-failure",
        label: "Initiative auswürfeln",
        description:
          "Der Kampf beginnt ohne klaren Vorteil. Ryu, Ayane und die Gegner würfeln Initiative.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-gegner-perfekt-gelesen",
    title: "Perfekter Kampfblick",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu sieht den Angriff, bevor er beginnt. Der Schattenräuber täuscht rechts an, doch sein Stand verrät den wahren Schnitt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu liest den Gegner perfekt. Der erste Angriff wird über die linke Flanke kommen.",
      },
      {
        speaker: "Ayane",
        text: "Ich sehe es. Wenn er zieht, bleibt seine Mitte offen.",
      },
    ],
    choices: [
      {
        id: "start-initiative-after-read-nat20",
        label: "Mit Vorteil in die Initiative gehen",
        description:
          "Der Kampf beginnt. Der DM kann diesen perfekten Blick später als taktischen Vorteil auswerten.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-gegner-falsch-gelesen",
    title: "Falscher Winkel",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu deutet die Bewegung falsch. Der Schattenräuber lässt genau diese falsche Annahme zu und setzt den ersten Schritt anders, als erwartet.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Für einen Augenblick wirkt die rechte Seite offen. Dann kippt der Gegner den Stand und die Falle wird sichtbar.",
      },
      {
        speaker: "Ayane",
        text: "Ryu, nicht dahin. Er will dich ziehen.",
      },
    ],
    choices: [
      {
        id: "start-initiative-after-read-nat1",
        label: "Initiative unter Druck auswürfeln",
        description:
          "Der Kampf beginnt mit schlechter Positionierung. Der DM kann diese Fehldeutung als taktischen Nachteil auswerten.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-katana-erster-schlag",
    title: "Erster Schlag",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu tritt durch den Regen nach vorn. Stahl zieht eine helle Linie durch die Dunkelheit, während der Schattenräuber seine Klinge hebt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu schließt die Distanz. Der Schattenräuber reagiert schnell, aber nicht schnell genug, um den Angriff einfach zu ignorieren.",
      },
      {
        speaker: "DM",
        text: "Für einen Moment entscheidet nur der Wurf, ob Ryus Klinge die Deckung des Gegners bricht.",
      },
    ],
    choices: [
      {
        id: "combat-return-after-katana",
        label: "Initiative auswürfeln",
        description:
          "Der Kampf beginnt. Ryu, Ayane und die Gegner würfeln Initiative, bevor die erste Kampfrunde festgelegt wird.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-kunai-distanz",
    title: "Kunai im Regen",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu bleibt auf Distanz. Ein Kunai verschwindet für einen Herzschlag im Regen, bevor es auf den Schattenräuber zusaust.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu nutzt den Abstand, statt ihn aufzugeben. Der Wurf zwingt den Gegner, seine Bewegung zu ändern.",
      },
      {
        speaker: "DM",
        text: "Der Gegner muss wählen: weiter vorrücken oder dem heranschneidenden Stahl ausweichen.",
      },
    ],
    choices: [
      {
        id: "combat-return-after-kunai",
        label: "Initiative auswürfeln",
        description:
          "Der Kampf beginnt. Ryu, Ayane und die Gegner würfeln Initiative, bevor die erste Kampfrunde festgelegt wird.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-ayane-licht",
    title: "Ayanes Licht",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "Ayane",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ayane hebt die Hand. Warmes Licht sammelt sich zwischen ihren Fingern, nicht grell, sondern kontrolliert.",
    dialogueLines: [
      {
        speaker: "Ayane",
        text: "Ich halte ihn offen. Wenn er Ryu bedrängt, nehme ich ihm den Winkel.",
      },
      {
        speaker: "DM",
        text: "Ihr Blick springt zwischen Ryu und dem Schattenräuber. Sie wartet nur auf den Moment, in dem ihre Hilfe den Kampf kippt.",
      },
    ],
    choices: [
      {
        id: "combat-return-after-ayane",
        label: "Initiative auswürfeln",
        description:
          "Der Kampf beginnt. Ryu, Ayane und die Gegner würfeln Initiative, bevor die erste Kampfrunde festgelegt wird.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-initiative-start",
    title: "Initiative",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Die Schatten ziehen Waffen. Jetzt wird die Reihenfolge entschieden: Ryu, Ayane und jeder Gegner würfeln Initiative, bevor die erste Kampfrunde beginnt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Die Zeit zieht sich zusammen. Erst Initiative, dann handelt jede Kreatur in Reihenfolge.",
      },
      {
        speaker: "DM",
        text: "Ryu, Ayane und die Schatten setzen gleichzeitig an. Wer zuerst handelt, entscheidet der Moment zwischen Atemzug und Klinge.",
      },
    ],
    choices: [
      {
        id: "initiative-placeholder-ready",
        label: "Initiative im Charakterbogen würfeln",
        description:
          "Würfle Initiative für Ryu und Ayane. Danach kann die erste echte Kampfrunde mit Backend-Reihenfolge starten.",
        nextSceneId: "kampf-initiative-start",
      },
    ],
  },
  {
    id: "kampf-runde-eins",
    title: "Kampfrunde 1",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Die Reihenfolge steht. Regen läuft über Stahl, während die erste Kampfrunde beginnt und jede Entscheidung Raum, Reichweite und Risiko verändert.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Die Initiative ist entschieden. Jetzt handelt jede Kreatur in Reihenfolge.",
      },
      {
        speaker: "DM",
        text: "Ryu und Ayane stehen bereit. Die Schattenräuber verteilen sich in der Gasse und suchen den ersten Fehler.",
      },
    ],
    choices: [
      {
        id: "round-one-ryu-attack",
        label: "Ryu greift den vorderen Schattenräuber an",
        description:
          "Ryu nutzt seine Aktion für einen Angriff. Wähle im Charakterbogen Katana oder Kunai, damit der Wurf im HUD erscheint.",
        nextSceneId: "kampf-runde-eins-ryu-angriff",
      },
      {
        id: "round-one-ayane-support",
        label: "Ayane unterstützt nach DM-Ansage",
        description:
          "Der DM beschreibt Ayanes Companion-Aktion. Danach würfelst du über Ayanes NPC-Bogen.",
        nextSceneId: "kampf-runde-eins-ayane-unterstuetzt",
      },
      {
        id: "round-one-defensive-read",
        label: "Ryu bleibt defensiv und beobachtet die Gegner",
        description:
          "Ryu hält die Position und sucht nach dem nächsten Angriffswinkel der Schattenräuber.",
        nextSceneId: "kampf-runde-eins-defensiv-erkannt",
        failureSceneId: "kampf-runde-eins-defensiv-unklar",
        natural20SceneId: "kampf-runde-eins-defensiv-perfekt",
        natural1SceneId: "kampf-runde-eins-defensiv-fehler",
        checks: [
          {
            ability: "WIS",
            skill: "Insight",
            dc: 14,
          },
          {
            ability: "WIS",
            skill: "Perception",
            dc: 14,
          },
        ],
      },
    ],
  },
  {
    id: "kampf-runde-eins-ryu-angriff",
    title: "Ryus Angriff",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu tritt in die Kampflinie. Regen schlägt gegen Stahl, während der vordere Schattenräuber seine Deckung hebt.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu ist am Zug. Wähle im Charakterbogen Katana für den Nahkampf oder Kunai für den Distanzwurf.",
      },
      {
        speaker: "DM",
        text: "Der Angriffswurf entscheidet, ob die Deckung des Schattenräubers bricht. Danach wird der Schaden ausgewertet.",
      },
    ],
    choices: [
      {
        id: "ryu-attack-resolved",
        label: "Angriffswurf im Charakterbogen ausführen",
        description:
          "Würfle zuerst Angriff und danach Schaden über Ryus Aktionen. Der Backend-Kampfresolver wertet Treffer und Schaden später automatisch aus.",
        nextSceneId: "kampf-runde-eins-nach-ryu",
      },
    ],
  },
  {
    id: "kampf-runde-eins-nach-ryu",
    title: "Nach Ryus Angriff",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Der erste Schlag zwingt die Schattenräuber, ihre Formation zu ändern. Einer weicht zurück, der andere sucht eine Lücke.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryus Angriff verändert die Distanz. Die Schattenräuber verlieren für einen Moment ihre klare Linie.",
      },
      {
        speaker: "Ayane",
        text: "Ich sehe die Öffnung. Wenn du sie bindest, halte ich die Flanke.",
      },
    ],
    choices: [
      {
        id: "continue-to-ayane-support",
        label: "Ayane in die Handlung einbinden",
        description:
          "Der DM beschreibt Ayanes Companion-Aktion für diese Runde.",
        nextSceneId: "kampf-runde-eins-ayane-unterstuetzt",
      },
    ],
  },
  {
    id: "kampf-runde-eins-ayane-unterstuetzt",
    title: "Ayanes Unterstützung",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "Ayane",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ayane bleibt nicht passiv. Sie hält Abstand, liest die Flanke und sucht den Moment, in dem ihre Hilfe mehr zählt als ein überstürzter Schlag.",
    dialogueLines: [
      {
        speaker: "Ayane",
        text: "Ich halte Licht bereit. Wenn einer durchbricht, zwinge ich ihn zurück.",
      },
      {
        speaker: "DM",
        text: "Ayane kann jetzt über den NPC-Bogen handeln: Angriff, Schaden oder später Heilung, abhängig von der DM-Ansage.",
      },
    ],
    choices: [
      {
        id: "ayane-action-resolved",
        label: "Ayanes Aktion im NPC-Bogen würfeln",
        description:
          "Würfle die vom DM angesagte Aktion über Ayanes NPC-Begleiterbogen.",
        nextSceneId: "kampf-runde-eins-gegner-am-zug",
      },
    ],
  },
  {
    id: "kampf-runde-eins-defensiv-erkannt",
    title: "Defensive Linie",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu bleibt ruhig und liest die Bewegung. Die Schattenräuber wollen nicht sofort töten, sondern euch trennen.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Ryu erkennt den Plan: Ein Gegner bindet vorne, der zweite will über die Seite an Ayane vorbei.",
      },
      {
        speaker: "Ayane",
        text: "Dann halte ich mich nicht zu weit links. Sag mir, wen du bindest.",
      },
    ],
    choices: [
      {
        id: "defensive-go-to-enemy-turn",
        label: "Gegnerzug abwarten",
        description:
          "Ryu behält die defensive Linie. Die Gegner sind am Zug.",
        nextSceneId: "kampf-runde-eins-gegner-am-zug",
      },
    ],
  },
  {
    id: "kampf-runde-eins-defensiv-unklar",
    title: "Unklare Flanke",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu bleibt defensiv, aber der Regen macht die Bewegung schwer lesbar. Die Schattenräuber nutzen die Unklarheit.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Du siehst Bewegung, aber nicht den genauen Winkel. Der nächste Gegnerzug bleibt gefährlich offen.",
      },
    ],
    choices: [
      {
        id: "unclear-go-to-enemy-turn",
        label: "Gegnerzug abwarten",
        description:
          "Die Gegner handeln, bevor die Linie vollständig gelesen ist.",
        nextSceneId: "kampf-runde-eins-gegner-am-zug",
      },
    ],
  },
  {
    id: "kampf-runde-eins-defensiv-perfekt",
    title: "Perfekte Kampflesung",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu erkennt den Gegnerzug, bevor er beginnt. Jeder Schritt der Schattenräuber verrät ihre Absicht.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Natural 20: Ryu liest die komplette Flanke. Der nächste Angriff kann taktisch vorbereitet werden.",
      },
    ],
    choices: [
      {
        id: "perfect-read-go-to-enemy-turn",
        label: "Gegnerzug mit taktischem Vorteil abwarten",
        description:
          "Die DM-Logik kann diese perfekte Lesung später als Vorteil für Reaktion oder Positionierung auswerten.",
        nextSceneId: "kampf-runde-eins-gegner-am-zug",
      },
    ],
  },
  {
    id: "kampf-runde-eins-defensiv-fehler",
    title: "Falsche Deckung",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Ryu liest den Winkel falsch. Ein Schattenräuber nutzt den Moment und setzt genau dorthin an, wo die Deckung schwächer ist.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Natural 1: Die Linie wirkt sicher, aber der Gegner hat diese Reaktion erwartet.",
      },
    ],
    choices: [
      {
        id: "bad-read-go-to-enemy-turn",
        label: "Gegnerzug unter Druck abwarten",
        description:
          "Die Gegner handeln mit besserer Position, bis die Backend-Kampfauflösung aktiv übernimmt.",
        nextSceneId: "kampf-runde-eins-gegner-am-zug",
      },
    ],
  },
  {
    id: "kampf-runde-eins-gegner-am-zug",
    title: "Gegner am Zug",
    location: "Falkenwacht - Innere Handelsroute",
    chapter: "Session 1 · Kampf",
    speaker: "DM",
    imageUrl: "/scenes/combat-ambush-trade-route.png",
    narration:
      "Die Schattenräuber handeln. Einer bindet die Front, der andere sucht Raum, um die Linie zwischen Ryu und Ayane aufzubrechen.",
    dialogueLines: [
      {
        speaker: "DM",
        text: "Der Gegnerzug ist vorbereitet. Sobald Backend-Encounter aktiv sind, würfelt der DM verdeckt Angriff und Schaden.",
      },
      {
        speaker: "DM",
        text: "Für das Frontend-MVP endet die erste Kampfrunde hier und bleibt bereit für die Backend-Kampfauflösung.",
      },
    ],
    choices: [
      {
        id: "round-one-back-to-order",
        label: "Kampfrunde 1 erneut anzeigen",
        description:
          "Zurück zur Kampfrundenübersicht, bis die Backend-Kampfauflösung die nächste Runde erzeugt.",
        nextSceneId: "kampf-runde-eins",
      },
    ],
  },
];

export const initialSceneId = "titel-falkenwacht";
