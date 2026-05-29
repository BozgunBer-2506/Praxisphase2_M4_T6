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
        id: "return-campaigns-after-accept",
        label: "Speicherstand im Kampagnenportal prüfen",
        description:
          "Öffne den Main-Bereich und prüfe, ob diese Entscheidung als Speicherstand vorhanden ist.",
        nextSceneId: "auftrag-angenommen",
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
        id: "return-campaigns-after-details",
        label: "Speicherstand im Kampagnenportal prüfen",
        description:
          "Öffne den Main-Bereich und prüfe, ob diese Entscheidung als Speicherstand vorhanden ist.",
        nextSceneId: "auftrag-details",
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
        id: "return-campaigns-after-suspicion",
        label: "Speicherstand im Kampagnenportal prüfen",
        description:
          "Öffne den Main-Bereich und prüfe, ob diese Entscheidung als Speicherstand vorhanden ist.",
        nextSceneId: "auftrag-misstrauen",
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
];

export const initialSceneId = "titel-falkenwacht";
