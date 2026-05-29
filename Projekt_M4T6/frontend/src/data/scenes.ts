export type CharacterId = "ryu" | "ayane";

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
  check?: {
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    skill?: string;
    dc: number;
  };
};

export type Scene = {
  id: string;
  title: string;
  location: string;
  chapter: string;
  speaker: string;
  narration: string;
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
    choices: [
      {
        id: "prolog-start",
        label: "Zur Abenteurergilde Falkenwacht gehen",
        description:
          "Du folgst der Spur zum Ort, an dem neue Aufträge, Gerüchte und gefährliche Wahrheiten zusammenlaufen.",
        nextSceneId: "gilde-varian-thorn",
      },
    ],
  },
  {
    id: "gilde-varian-thorn",
    title: "Varian Thorn und der Auftrag",
    location: "Abenteurergilde Falkenwacht",
    chapter: "Session 1",
    speaker: "Varian Thorn",
    imageUrl: "/scenes/guild-varian-thorn.png",
    narration:
      "Varian Thorn erwartet dich in der Abenteurergilde. Seine Stimme bleibt ruhig, doch die Anspannung im Raum ist deutlich zu spüren. Das Ei muss gefunden werden, bevor aus dem Diebstahl ein größerer Konflikt entsteht.",
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
        check: {
          ability: "INT",
          skill: "Investigation",
          dc: 12,
        },
      },
      {
        id: "react-suspiciously",
        label: "Misstrauisch reagieren",
        description:
          "Du beobachtest Varian genauer und prüfst, ob er euch die ganze Wahrheit sagt.",
        nextSceneId: "auftrag-misstrauen",
        check: {
          ability: "WIS",
          skill: "Insight",
          dc: 13,
        },
      },
    ],
  },
];

export const initialSceneId = "titel-falkenwacht";
