"use client";

import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Dice5,
  HeartPulse,
  LogIn,
  Palette,
  ScrollText,
  Send,
  ShieldCheck,
  Swords,
  UserPlus,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CharacterId,
  type Choice,
  type SkillCheck,
  characters,
  initialSceneId,
  scenes,
} from "@/data/scenes";
import {
  type CombatResolveResponse,
  type EncounterAutoTurnAction,
  type EncounterState,
  type FrontendEncounterActor,
  type FrontendEncounterState,
  type HudEvent,
  type InventoryAction,
  type InventoryStateItem,
  type InventoryViewItem,
  type SaveGameState,
  askAiDmHelp,
  createOrUpdateSave,
  getInventoryView,
  resolveCombat,
  resolveSaveEncounterAttackRoll,
  resolveSaveEncounterAutoTurn,
  resolveSaveEncounterDamageRoll,
  runSaveInventoryAction,
} from "@/lib/backendApi";

const SAVE_KEY = "falkenwacht.saveStates";
const LAST_SAVE_KEY = "falkenwacht.lastSave";
const MAX_ACCOUNT_SAVES = 15;
const MAX_CAMPAIGN_SAVES = 5;
const CAMPAIGN_TITLE = "Falkenwacht - Die Korruption der Greifenstadt";
const WORD_REVEAL_MS = 85;
const diceTypes = [4, 6, 8, 10, 12, 20, 100] as const;
const BACKEND_SLOT_NAME = "autosave";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const toBackendCharacterId = (characterId: CharacterId) =>
  characterId === "ryu" ? "ayane" : "johan";

const toFrontendCharacterId = (characterId: string): CharacterId | null => {
  if (characterId === "ayane") {
    return "ryu";
  }

  if (characterId === "johan") {
    return "ayane";
  }

  return null;
};

const parseDiceFormula = (formula: string) => {
  const normalizedFormula = formula.replace(/\s/g, "");
  const match = normalizedFormula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);

  if (!match) {
    return null;
  }

  return {
    diceCount: Number(match[1] || "1"),
    diceType: Number(match[2]),
    modifier: Number(match[3] || "0"),
  };
};

const buildCombatHudEvents = (response: CombatResolveResponse): HudEvent[] => {
  const events: HudEvent[] = [
    {
      type: "attack_roll",
      label: "Angriff",
      payload: response.attack,
    },
  ];

  if (response.attack.hit) {
    events.push(
      {
        type: "damage",
        label: "Schaden",
        payload: response.damage,
      },
      {
        type: "hp_change",
        label: "Ziel-HP",
        payload: response.hp,
      },
    );
  }

  return events;
};

const characterRuleStats: Record<CharacterId, { dexModifier: number }> = {
  ryu: { dexModifier: 2 },
  ayane: { dexModifier: 0 },
};

const initialInventory: InventoryStateItem[] = [
  {
    item_id: "healing_potion",
    name: "Healing Potion",
    quantity: 2,
  },
  {
    item_id: "torch",
    name: "Torch",
    quantity: 1,
  },
  {
    item_id: "leather_armor",
    name: "Leather Armor",
    quantity: 1,
  },
];

const characterSheets = {
  ryu: {
    saves: [
      ["STR", "+6"],
      ["DEX", "+2"],
      ["CON", "+6"],
      ["WIS", "+1"],
    ],
    skills: [
      ["Acrobatics", "+2"],
      ["Animal Handling", "+1"],
      ["Arcana", "-1"],
      ["Athletics", "+3"],
      ["Deception", "+3"],
      ["History", "-1"],
      ["Insight", "+4"],
      ["Intimidation", "+0"],
      ["Investigation", "-1"],
      ["Medicine", "+1"],
      ["Nature", "-1"],
      ["Perception", "+1"],
      ["Performance", "+0"],
      ["Persuasion", "+3"],
      ["Religion", "-1"],
      ["Sleight of Hand", "+2"],
      ["Stealth", "+5"],
      ["Survival", "+4"],
    ],
    actions: [
      {
        name: "Katana",
        attack: 6,
        damage: "1d8+3",
        note: "Longsword-Flavor | Slash | Nahkampf 5 ft.",
      },
      {
        name: "Wakizashi",
        attack: 6,
        damage: "1d6+3",
        note: "Shortsword-Flavor | Slash | Nahkampf 5 ft.",
      },
      {
        name: "Kunai",
        attack: 6,
        damage: "1d4+3",
        note: "Dagger-Flavor | Slash | Nahkampf 5 ft. | Fernkampf 30 ft.",
      },
    ],
  },
  ayane: {
    saves: [
      ["WIS", "+7"],
      ["CHA", "+3"],
      ["CON", "+1"],
      ["INT", "+1"],
    ],
    skills: [
      ["Acrobatics", "+0"],
      ["Animal Handling", "+4"],
      ["Arcana", "+8"],
      ["Athletics", "+2"],
      ["Deception", "+0"],
      ["History", "+4"],
      ["Insight", "+4"],
      ["Intimidation", "+0"],
      ["Investigation", "+1"],
      ["Medicine", "+7"],
      ["Nature", "+1"],
      ["Perception", "+7"],
      ["Performance", "+0"],
      ["Persuasion", "+0"],
      ["Religion", "+8"],
      ["Sleight of Hand", "+0"],
      ["Stealth", "+0"],
      ["Survival", "+4"],
    ],
    actions: [
      {
        name: "Mace",
        attack: 5,
        damage: "1d6+2",
        note: "Simple Weapon",
      },
      {
        name: "Guiding Bolt",
        attack: 7,
        damage: "4d6",
        note: "Spell Attack",
      },
      {
        name: "Ray of Frost",
        attack: 7,
        damage: "2d8",
        note: "Cantrip",
      },
    ],
  },
} as const;

type SaveState = {
  id: string;
  campaignTitle: string;
  sessionTitle: string;
  sceneId: string;
  sceneTitle: string;
  characterId: CharacterId;
  choiceLabel: string;
  createdAt: string;
};

type RuntimeStats = {
  currentHp: number;
  maxHp: number;
  ac: number;
  speed: number;
};

type RollMode = "normal" | "advantage" | "disadvantage";

type RollResult = {
  diceType: number;
  rolls: number[];
  selectedRoll: number;
  modifier: number;
  total: number;
  mode: RollMode;
  label?: string;
};

type DiceColor = "ember" | "arcane" | "venom" | "blood";

type DmMessage = {
  id: string;
  sender: "Spieler" | "DM";
  text: string;
  command?: string;
  topics?: string[];
  allowedScope?: string[];
  stateLocked?: boolean;
};

type GameLogEntry = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  total?: number;
};

type PendingCheck = {
  choice: Choice;
  checks: SkillCheck[];
};

type InitiativeActor = {
  id: string;
  name: string;
  kind: "player" | "companion" | "enemy";
  total?: number;
};

type EnemyCombatState = {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  speed: number;
  conditions: string[];
};

type CombatRoundState = {
  encounterId: string;
  round: number;
  activeActorId: string | null;
  turnIndex: number;
  initiativeOrder: InitiativeActor[];
  enemies: EnemyCombatState[];
  awaitingRoll: "attack" | "damage" | "save" | "initiative" | null;
  lastBackendEvents: HudEvent[];
  turnControl: FrontendEncounterState["turnControl"] | null;
  lastResolution: FrontendEncounterState["lastResolution"];
};

type CombatAttackStep =
  | "idle"
  | "chooseAction"
  | "chooseTarget"
  | "awaitAttackRoll"
  | "awaitDamageRoll"
  | "turnResolved"
  | "enemyResolving";

type CombatAttackFlowState = {
  step: CombatAttackStep;
  actorId: string | null;
  actionName: string | null;
  attackFormula: string | null;
  damageFormula: string | null;
  targetId: string | null;
  attackTotal: number | null;
  attackHit: boolean | null;
  damageTotal?: number | null;
  remainingHp?: number | null;
};

const createInitialCombatEnemies = (): EnemyCombatState[] => [
  {
    id: "shadow-raider-1",
    name: "Schattenräuber A",
    currentHp: 16,
    maxHp: 16,
    ac: 14,
    speed: 30,
    conditions: [],
  },
  {
    id: "shadow-raider-2",
    name: "Schattenräuber B",
    currentHp: 16,
    maxHp: 16,
    ac: 14,
    speed: 30,
    conditions: [],
  },
];

const createInitialCombatRoundState = (): CombatRoundState => ({
  encounterId: "inner-trade-route-ambush",
  round: 0,
  activeActorId: null,
  turnIndex: 0,
  initiativeOrder: [],
  enemies: createInitialCombatEnemies(),
  awaitingRoll: null,
  lastBackendEvents: [],
  turnControl: null,
  lastResolution: null,
});

const createInitialCombatAttackFlowState = (): CombatAttackFlowState => ({
  step: "idle",
  actorId: null,
  actionName: null,
  attackFormula: null,
  damageFormula: null,
  targetId: null,
  attackTotal: null,
  attackHit: null,
  damageTotal: null,
  remainingHp: null,
});

const createCombatAttackFlowStateForActor = (
  actor: InitiativeActor | undefined,
  round: number,
): CombatAttackFlowState => ({
  ...createInitialCombatAttackFlowState(),
  actorId: actor?.id ?? null,
  step: round <= 0 ? "idle" : actor?.kind === "enemy" ? "enemyResolving" : "chooseAction",
});

const findScene = (sceneId: string) =>
  scenes.find((scene) => scene.id === sceneId) ?? scenes[0];

const calculateArmorClass = (
  characterId: CharacterId,
  inventory: InventoryStateItem[],
) => {
  const leatherArmor = inventory.find(
    (item) => item.item_id === "leather_armor" && item.equipped,
  );

  if (leatherArmor) {
    return 11 + characterRuleStats[characterId].dexModifier;
  }

  return characters[characterId].stats.ac;
};

const readSaveStates = (): SaveState[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const readLastSaveState = (): SaveState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(LAST_SAVE_KEY) ?? "null");
  } catch {
    return null;
  }
};

const isValidSaveState = (saveState: SaveState | null) =>
  Boolean(
    saveState &&
      scenes.some((scene) => scene.id === saveState.sceneId) &&
      (saveState.characterId === "ryu" || saveState.characterId === "ayane"),
  );

const findActiveLastSaveState = (): SaveState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const lastSaveState = readLastSaveState();
  const saveStates = readSaveStates();
  const matchingSaveState =
    lastSaveState && isValidSaveState(lastSaveState)
      ? saveStates.find((saveState) => saveState.id === lastSaveState.id)
      : null;

  if (!matchingSaveState) {
    window.localStorage.removeItem(LAST_SAVE_KEY);
    return null;
  }

  return matchingSaveState;
};

const findMatchingSaveState = (
  sceneId: string | null,
  characterId: CharacterId | null,
) => {
  if (!sceneId || !characterId) {
    return null;
  }

  return (
    readSaveStates().find(
      (saveState) =>
        saveState.sceneId === sceneId && saveState.characterId === characterId,
    ) ?? null
  );
};

export default function Home() {
  const [currentSceneId, setCurrentSceneId] = useState(initialSceneId);
  const [selectedCharacterId, setSelectedCharacterId] =
    useState<CharacterId | null>(null);
  const [dialogueLineIndex, setDialogueLineIndex] = useState(0);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [isDmPanelOpen, setIsDmPanelOpen] = useState(false);
  const [isDicePanelOpen, setIsDicePanelOpen] = useState(false);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [dmInput, setDmInput] = useState("");
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([
    {
      id: "dm-welcome",
      sender: "DM",
      text: "Out of Character: Frag mich zu Regeln, Szene, Hinweisen oder Spielmechanik. Später wird dieses Fenster mit der AI-DM-Logik verbunden.",
    },
  ]);
  const [diceType, setDiceType] = useState<(typeof diceTypes)[number]>(20);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [rollModifier, setRollModifier] = useState(0);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [rollAnimationKey, setRollAnimationKey] = useState(0);
  const [diceColor, setDiceColor] = useState<DiceColor>("ember");
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(true);
  const [isActionsExpanded, setIsActionsExpanded] = useState(true);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(true);
  const [isCompanionExpanded, setIsCompanionExpanded] = useState(false);
  const [inventoryState, setInventoryState] =
    useState<InventoryStateItem[]>(initialInventory);
  const [inventoryItems, setInventoryItems] = useState<InventoryViewItem[]>([]);
  const [inventoryStatus, setInventoryStatus] = useState(
    "Inventory bereit, Backend-Abgleich ausstehend.",
  );
  const [combatTargetHp, setCombatTargetHp] = useState(20);
  const [combatStatus, setCombatStatus] = useState(
    "Trainingsziel bereit: AC 14, HP 20.",
  );
  const [initiativeRolls, setInitiativeRolls] = useState<
    Partial<Record<CharacterId, number>>
  >({});
  const [initiativeRollModes, setInitiativeRollModes] = useState<
    Partial<Record<CharacterId, RollMode>>
  >({});
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeActor[]>([]);
  const [combatRoundState, setCombatRoundState] = useState<CombatRoundState>(
    createInitialCombatRoundState,
  );
  const [combatAttackFlowState, setCombatAttackFlowState] =
    useState<CombatAttackFlowState>(createInitialCombatAttackFlowState);
  const [selectedCombatTargetId, setSelectedCombatTargetId] = useState<string | null>(
    null,
  );
  const [isBackendTurnResolving, setIsBackendTurnResolving] = useState(false);
  const [initiativeStatus, setInitiativeStatus] = useState(
    "Initiative offen: Ryu und Ayane müssen würfeln.",
  );
  const [runtimeStats, setRuntimeStats] = useState<Record<CharacterId, RuntimeStats>>(
    () => ({
      ryu: {
        currentHp: characters.ryu.stats.hp,
        maxHp: characters.ryu.stats.hp,
        ac: characters.ryu.stats.ac,
        speed: characters.ryu.stats.speed,
      },
      ayane: {
        currentHp: characters.ayane.stats.hp,
        maxHp: characters.ayane.stats.hp,
        ac: characters.ayane.stats.ac,
        speed: characters.ayane.stats.speed,
      },
    }),
  );
  const [hudEvents, setHudEvents] = useState<HudEvent[]>([]);
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null);
  const [openChoiceCheckId, setOpenChoiceCheckId] = useState<string | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([
    {
      id: "log-start",
      title: "Session gestartet",
      detail: "Game-Log bereit. Würfe und Skillchecks erscheinen hier.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const diceColorClass: Record<DiceColor, string> = {
    ember: "from-ember-400 to-orange-700 text-ink-950 border-ember-300",
    arcane: "from-cyan-300 to-blue-700 text-ink-950 border-cyan-200",
    venom: "from-lime-300 to-emerald-700 text-ink-950 border-lime-200",
    blood: "from-red-400 to-rose-900 text-white border-red-300",
  };

  const diceColorDotClass: Record<DiceColor, string> = {
    ember: "bg-ember-500",
    arcane: "bg-cyan-400",
    venom: "bg-lime-400",
    blood: "bg-red-500",
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sceneParam = params.get("scene");
    const characterParam = params.get("character") as CharacterId | null;
    const hasValidSceneParam =
      Boolean(sceneParam) && scenes.some((scene) => scene.id === sceneParam);
    const hasValidCharacterParam =
      characterParam === "ryu" || characterParam === "ayane";

    if (hasValidSceneParam || hasValidCharacterParam) {
      const matchingSaveState =
        hasValidSceneParam && hasValidCharacterParam
          ? findMatchingSaveState(sceneParam, characterParam)
          : null;

      if (matchingSaveState) {
        setCurrentSceneId(matchingSaveState.sceneId);
        setSelectedCharacterId(matchingSaveState.characterId);
      } else {
        window.history.replaceState(null, "", window.location.pathname);
        window.localStorage.removeItem(LAST_SAVE_KEY);
      }

      return;
    }

    const lastSaveState = findActiveLastSaveState();

    if (lastSaveState) {
      setCurrentSceneId(lastSaveState.sceneId);
      setSelectedCharacterId(lastSaveState.characterId);
    }
  }, []);

  const currentScene = findScene(currentSceneId);
  const activeCharacter = selectedCharacterId
    ? characters[selectedCharacterId]
    : null;
  const activeNpc =
    selectedCharacterId === "ryu"
      ? characters.ayane
      : selectedCharacterId === "ayane"
        ? characters.ryu
        : null;
  const isCharacterSelection = currentScene.id === "charakterwahl";
  const isTitleScene = currentScene.id === "titel-falkenwacht";
  const currentDialogueLine =
    currentScene.dialogueLines[dialogueLineIndex] ??
    currentScene.dialogueLines[0];
  const dialogueWords = useMemo(
    () => currentDialogueLine.text.split(" "),
    [currentDialogueLine.text],
  );
  const isDialogueFullyVisible = visibleWordCount >= dialogueWords.length;
  const isLastDialogueLine =
    dialogueLineIndex >= currentScene.dialogueLines.length - 1;
  const activeSheet = selectedCharacterId
    ? characterSheets[selectedCharacterId]
    : null;
  const activeRuntimeStats = selectedCharacterId
    ? runtimeStats[selectedCharacterId]
    : null;
  const companionSheet = activeNpc ? characterSheets[activeNpc.id] : null;
  const companionRuntimeStats = activeNpc ? runtimeStats[activeNpc.id] : null;
  const isInitiativeScene = currentScene.id === "kampf-initiative-start";
  const isCombatScene =
    currentScene.id.startsWith("kampf-") ||
    currentScene.id === "hinterhalt-handelsroute";
  const visibleInitiativeOrder =
    combatRoundState.initiativeOrder.length > 0
      ? combatRoundState.initiativeOrder
      : initiativeOrder;
  const activeCombatActor = visibleInitiativeOrder.find(
    (actor) => actor.id === combatRoundState.activeActorId,
  );
  const actorName = activeCharacter?.name ?? "Der Charakter";
  const getCombatActorName = (actorId?: string | null) => {
    if (!actorId) {
      return "Unbekannt";
    }

    const initiativeActor = visibleInitiativeOrder.find(
      (actor) => actor.id === actorId,
    );
    const frontendCharacterId = toFrontendCharacterId(actorId);

    if (initiativeActor) {
      return initiativeActor.name;
    }

    if (frontendCharacterId) {
      return characters[frontendCharacterId].name;
    }

    return actorId;
  };
  const lastCombatResolution = combatRoundState.lastResolution;
  const lastCombatActorId = lastCombatResolution?.actorId ?? null;
  const isLastResolutionEnemyAction =
    lastCombatActorId !== null &&
    visibleInitiativeOrder.some(
      (actor) =>
        actor.id === lastCombatActorId && actor.kind === "enemy",
    );
  const isLastResolutionHeroAction =
    lastCombatActorId !== null &&
    visibleInitiativeOrder.some(
      (actor) =>
        actor.id === lastCombatActorId && actor.kind !== "enemy",
    );
  const availableCombatTargets =
    combatRoundState.turnControl?.availableTargets ?? [];
  const selectedCombatTarget =
    availableCombatTargets.find((target) => target.id === selectedCombatTargetId) ??
    null;
  const activeCombatSheet =
    activeCombatActor?.kind === "player"
      ? activeSheet
      : activeCombatActor?.kind === "companion"
        ? companionSheet
        : null;
  const activeCombatActions = activeCombatSheet?.actions ?? [];
  const requiresBackendDamageRoll =
    combatRoundState.turnControl?.requiresDamageRoll === true ||
    Boolean(
      combatRoundState.lastResolution?.attack?.hit &&
        combatAttackFlowState.step === "awaitDamageRoll",
    );
  const canResolveBackendDamageRoll =
    combatAttackFlowState.step === "awaitDamageRoll" &&
    requiresBackendDamageRoll;
  const combatFlowStepCopy: Record<CombatAttackStep, string> = {
    idle: "Warte auf Kampfrunde.",
    chooseAction: "Waehle eine Waffe oder einen Spell.",
    chooseTarget: "Waehle ein Ziel fuer diese Aktion.",
    awaitAttackRoll: "Angriffswurf erforderlich. Der Zug pausiert bis zum Hit Roll.",
    awaitDamageRoll: "Treffer. Schadenwurf erforderlich, bevor der Zug endet.",
    turnResolved: "Aktion ausgewertet. Der Zug kann beendet werden.",
    enemyResolving: "DM-KI fuehrt den Gegnerzug verdeckt aus.",
  };
  const backendEncounterState = useMemo<EncounterState | null>(() => {
    if (combatRoundState.round === 0 || visibleInitiativeOrder.length === 0) {
      return null;
    }

    const mainCharacter = activeCharacter ?? characters.ryu;
    const companion = activeNpc ?? characters.ayane;
    const mainRuntime = runtimeStats[mainCharacter.id];
    const companionRuntime = runtimeStats[companion.id];
    const heroParticipants = [
      {
        participant_id: toBackendCharacterId(mainCharacter.id),
        side: "heroes" as const,
        current_hp: mainRuntime.currentHp,
        max_hp: mainRuntime.maxHp,
        defeated: mainRuntime.currentHp <= 0,
        armor_class: mainRuntime.ac,
        speed: mainRuntime.speed,
      },
      {
        participant_id: toBackendCharacterId(companion.id),
        side: "heroes" as const,
        current_hp: companionRuntime.currentHp,
        max_hp: companionRuntime.maxHp,
        defeated: companionRuntime.currentHp <= 0,
        armor_class: companionRuntime.ac,
        speed: companionRuntime.speed,
      },
    ];
    const enemyParticipants = combatRoundState.enemies.map((enemy) => ({
      participant_id: enemy.id,
      side: "enemies" as const,
      current_hp: enemy.currentHp,
      max_hp: enemy.maxHp,
      defeated: enemy.currentHp <= 0,
      armor_class: enemy.ac,
      speed: enemy.speed,
    }));
    const toBackendActorId = (actor: InitiativeActor) => {
      if (actor.kind === "player") {
        return toBackendCharacterId(mainCharacter.id);
      }

      if (actor.kind === "companion") {
        return toBackendCharacterId(companion.id);
      }

      return actor.id;
    };
    const activeActor = visibleInitiativeOrder.find(
      (actor) => actor.id === combatRoundState.activeActorId,
    );

    return {
      round_number: combatRoundState.round,
      turn_index: combatRoundState.turnIndex,
      active_participant_id:
        activeActor !== undefined
          ? toBackendActorId(activeActor)
          : toBackendActorId(visibleInitiativeOrder[0]),
      initiative_order: visibleInitiativeOrder.map((actor, index) => ({
        participant_id: toBackendActorId(actor),
        roll: actor.total ?? 0,
        modifier: 0,
        total: actor.total ?? visibleInitiativeOrder.length - index,
        nat20: false,
        nat1: false,
      })),
      participants: [...heroParticipants, ...enemyParticipants],
      combat_finished: combatRoundState.enemies.every(
        (enemy) => enemy.currentHp <= 0,
      ),
    };
  }, [
    activeCharacter,
    activeNpc,
    combatRoundState,
    runtimeStats,
    visibleInitiativeOrder,
  ]);
  const backendSaveState = useMemo<SaveGameState>(() => {
    const mainCharacter = activeCharacter ?? characters.ryu;
    const companion = activeNpc ?? characters.ayane;
    const mainRuntime = runtimeStats[mainCharacter.id];
    const companionRuntime = runtimeStats[companion.id];

    return {
      main_character: {
        character_id: toBackendCharacterId(mainCharacter.id),
        current_hp: mainRuntime.currentHp,
        max_hp: mainRuntime.maxHp,
        conditions: [],
      },
      npc_companion: {
        character_id: toBackendCharacterId(companion.id),
        current_hp: companionRuntime.currentHp,
        max_hp: companionRuntime.maxHp,
        conditions: [],
      },
      story_flags: {
        egg_stolen: true,
      },
      inventory: inventoryState,
      encounter: backendEncounterState,
    };
  }, [
    activeCharacter,
    activeNpc,
    backendEncounterState,
    inventoryState,
    runtimeStats,
  ]);
  const pendingSkillNames = new Set(
    pendingCheck?.checks
      .map((check) => check.skill)
      .filter((skill): skill is string => Boolean(skill)) ?? [],
  );

  const addGameLog = (entry: Omit<GameLogEntry, "id" | "createdAt">) => {
    setGameLog((items) => [
      {
        id: createId(),
        createdAt: new Date().toISOString(),
        ...entry,
      },
      ...items,
    ].slice(0, 20));
  };

  const formatHudEvent = (event: HudEvent) => {
    const payload = event.payload ?? {};
    const healing = payload.healing;

    if (
      event.type === "hp_change" &&
      typeof healing === "object" &&
      healing !== null &&
      "total" in healing &&
      "modifier" in healing &&
      "rolls" in healing &&
      typeof healing.total === "number" &&
      typeof healing.modifier === "number" &&
      Array.isArray(healing.rolls)
    ) {
      return `Healing Potion: 2d4 + ${healing.modifier} = +${healing.total} HP (Würfe ${healing.rolls.join(" / ")})`;
    }

    if (event.type === "inventory_equip") {
      return `${event.item_id ?? "Item"} ausgerüstet`;
    }

    if (event.type === "inventory_unequip") {
      return `${event.item_id ?? "Item"} abgelegt`;
    }

    if (
      event.type === "attack_roll" &&
      typeof payload.roll === "number" &&
      typeof payload.modifier === "number" &&
      typeof payload.total === "number" &&
      typeof payload.target_ac === "number"
    ) {
      const hitText = payload.hit ? "Treffer" : "Verfehlt";
      const criticalText = payload.critical ? " · Kritisch" : "";

      return `Angriff: d20 ${payload.roll} + Mod ${payload.modifier} = ${payload.total} gegen AC ${payload.target_ac} · ${hitText}${criticalText}`;
    }

    if (
      event.type === "damage" &&
      typeof payload.dice_count === "number" &&
      typeof payload.die_sides === "number" &&
      typeof payload.modifier === "number" &&
      typeof payload.total === "number" &&
      Array.isArray(payload.rolls)
    ) {
      return `Schaden: ${payload.dice_count}d${payload.die_sides} + ${payload.modifier} = ${payload.total} (Würfe ${payload.rolls.join(" / ")})`;
    }

    if (
      event.type === "hp_change" &&
      typeof payload.previous_hp === "number" &&
      typeof payload.damage === "number" &&
      typeof payload.remaining_hp === "number"
    ) {
      return `Ziel-HP: ${payload.previous_hp} - ${payload.damage} = ${payload.remaining_hp}`;
    }

    const total = payload.total ?? payload.remaining_hp ?? payload.hit;

    return `${event.label ?? event.type}${total !== undefined ? `: ${String(total)}` : ""}`;
  };

  const applyHudEvents = (events: HudEvent[]) => {
    if (events.length === 0) {
      return;
    }

    setHudEvents((items) => [...events, ...items].slice(0, 8));
    addGameLog({
      title: "Backend-HUD Events",
      detail: events.map(formatHudEvent).join(" | "),
    });

    const visibleEvent = events.find((event) => event.type === "damage") ??
      events.find((event) => event.type === "hp_change") ??
      events.find((event) => {
      const payload = event.payload ?? {};
      const healing = payload.healing;

      return (
        typeof payload.total === "number" ||
        (typeof healing === "object" &&
          healing !== null &&
          "total" in healing &&
          typeof healing.total === "number") ||
        typeof payload.remaining_hp === "number"
      );
    });

    if (!visibleEvent) {
      return;
    }

    const payload = visibleEvent.payload ?? {};
    const healing = payload.healing;
    const healingRolls =
      typeof healing === "object" &&
      healing !== null &&
      "rolls" in healing &&
      Array.isArray(healing.rolls)
        ? healing.rolls.filter((roll): roll is number => typeof roll === "number")
        : null;
    const healingModifier =
      typeof healing === "object" &&
      healing !== null &&
      "modifier" in healing &&
      typeof healing.modifier === "number"
        ? healing.modifier
        : null;
    const payloadRolls = Array.isArray(payload.rolls)
      ? payload.rolls.filter((roll): roll is number => typeof roll === "number")
      : null;
    const attackRolls =
      typeof payload.roll === "number" ? [payload.roll] : null;
    const eventRolls = healingRolls ?? payloadRolls ?? attackRolls;
    const eventModifier =
      typeof payload.modifier === "number" ? payload.modifier : healingModifier;
    const eventDiceType =
      typeof payload.die_sides === "number"
        ? payload.die_sides
        : eventRolls === healingRolls
          ? 4
          : 20;
    const total =
      typeof payload.total === "number"
        ? payload.total
        : typeof healing === "object" &&
            healing !== null &&
            "total" in healing &&
            typeof healing.total === "number"
          ? healing.total
          : typeof payload.remaining_hp === "number"
        ? payload.remaining_hp
        : 0;

    setRollResult({
      diceType: eventDiceType,
      rolls: eventRolls ?? [total],
      selectedRoll: total,
      modifier: eventModifier ?? 0,
      total,
      mode: "normal",
      label:
        healingRolls && healingModifier !== null
          ? "Healing Potion 2d4 + 2"
          : visibleEvent.label ?? visibleEvent.type,
    });
    setRollAnimationKey((currentKey) => currentKey + 1);
  };

  const mapEncounterActorKind = (
    actor: FrontendEncounterActor,
  ): InitiativeActor["kind"] => {
    if (actor.kind === "enemy" || actor.side === "enemies") {
      return "enemy";
    }

    return actor.id === toBackendCharacterId(selectedCharacterId ?? "ryu")
      ? "player"
      : "companion";
  };

  const applyFrontendEncounterState = (
    frontendState: FrontendEncounterState,
  ) => {
    const initiativeActors: InitiativeActor[] =
      frontendState.initiativeOrder.map((actor) => ({
        id: actor.id,
        name: actor.name,
        kind: mapEncounterActorKind(actor),
        total: actor.total ?? undefined,
      }));
    const enemies: EnemyCombatState[] = frontendState.enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      currentHp: enemy.currentHp ?? 0,
      maxHp: enemy.maxHp ?? 1,
      ac: enemy.ac ?? 10,
      speed: enemy.speed ?? 30,
      conditions: enemy.defeated ? ["Besiegt"] : [],
    }));

    setInitiativeOrder(initiativeActors);
    setCombatRoundState((currentState) => ({
      ...currentState,
      round: frontendState.round,
      activeActorId: frontendState.activeActorId,
      turnIndex: frontendState.turnIndex,
      initiativeOrder: initiativeActors,
      enemies,
      awaitingRoll: null,
      lastBackendEvents: frontendState.lastBackendEvents,
      turnControl: frontendState.turnControl,
      lastResolution: frontendState.lastResolution,
    }));
    setCombatAttackFlowState({
      actorId: frontendState.activeActorId,
      actionName: null,
      attackFormula: null,
      damageFormula: null,
      targetId: null,
      attackTotal: null,
      attackHit: null,
      step:
        frontendState.round <= 0
          ? "idle"
          : frontendState.turnControl?.requiresPlayerAction
            ? "chooseAction"
            : frontendState.turnControl?.autoResolvable
              ? "enemyResolving"
              : "idle",
    });
    setRuntimeStats((currentStats) => {
      const nextStats = { ...currentStats };

      frontendState.heroes.forEach((hero) => {
        const frontendCharacterId = toFrontendCharacterId(hero.id);

        if (!frontendCharacterId) {
          return;
        }

        nextStats[frontendCharacterId] = {
          ...nextStats[frontendCharacterId],
          currentHp: hero.currentHp ?? nextStats[frontendCharacterId].currentHp,
          maxHp: hero.maxHp ?? nextStats[frontendCharacterId].maxHp,
          speed: hero.speed ?? nextStats[frontendCharacterId].speed,
          ac: hero.ac ?? nextStats[frontendCharacterId].ac,
        };
      });

      return nextStats;
    });
    applyHudEvents(frontendState.hudEvents);
  };

  const syncInventoryView = async (nextInventory = inventoryState) => {
    try {
      const response = await getInventoryView(nextInventory);
      setInventoryItems(response.items);
      setInventoryStatus("Inventory mit Backend synchronisiert.");
    } catch (error) {
      setInventoryItems(nextInventory);
      setInventoryStatus(
        "Backend nicht erreichbar. Inventory bleibt lokal sichtbar.",
      );
      void error;
    }
  };

  const syncBackendSave = async (state = backendSaveState) => {
    if (!selectedCharacterId) {
      return;
    }

    try {
      await createOrUpdateSave({
        slot_name: BACKEND_SLOT_NAME,
        character_id: toBackendCharacterId(selectedCharacterId),
        scene_number:
          scenes.findIndex((scene) => scene.id === currentSceneId) + 1 || 1,
        state,
      });
    } catch (error) {
      void error;
    }
  };

  const getInventoryDescription = (item: InventoryViewItem) => {
    if (item.item_id === "healing_potion") {
      return "Potion of Healing nach D&D 5e: heilt 2d4 + 2 HP und wird beim Benutzen verbraucht.";
    }

    if (item.item_id === "leather_armor" && selectedCharacterId) {
      const armorClass = 11 + characterRuleStats[selectedCharacterId].dexModifier;

      return `Leather Armor nach D&D 5e: AC 11 + DEX-Modifikator. Für ${actorName}: AC ${armorClass}.`;
    }

    return item.description;
  };

  const handleInventoryAction = async (
    item: InventoryViewItem,
    action: InventoryAction,
  ) => {
    setInventoryStatus(`${item.name}: ${action} wird über Backend geprüft...`);

    try {
      await syncBackendSave();
      const response = await runSaveInventoryAction(
        BACKEND_SLOT_NAME,
        item.item_id,
        action,
      );

      setInventoryState(response.state.inventory);
      setInventoryItems(response.inventory);
      if (selectedCharacterId) {
        setRuntimeStats((currentStats) => ({
          ...currentStats,
          [selectedCharacterId]: {
            ...currentStats[selectedCharacterId],
            currentHp: response.state.main_character.current_hp,
            maxHp: response.state.main_character.max_hp,
            ac: calculateArmorClass(selectedCharacterId, response.state.inventory),
          },
        }));
      }
      applyHudEvents(response.events);
      const healingEvent = response.events.find(
        (event) => event.type === "hp_change",
      );
      const healing = healingEvent?.payload?.healing;
      const healingText =
        typeof healing === "object" && healing !== null && "total" in healing
          ? ` Heilung: ${String(healing.total)} HP.`
          : "";
      const armorText =
        item.item_id === "leather_armor" && selectedCharacterId
          ? ` AC jetzt ${calculateArmorClass(selectedCharacterId, response.state.inventory)}.`
          : "";

      setInventoryStatus(`${item.name}: ${action} ausgeführt.${healingText}${armorText}`);
    } catch (error) {
      setInventoryStatus(`Aktion fehlgeschlagen: ${item.name} (${action}).`);
      addGameLog({
        title: "Inventory-Aktion fehlgeschlagen",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  };

  const getChoiceChecks = (choice: Choice) =>
    choice.check ? [choice.check] : choice.checks ?? [];

  const formatCheckName = (check: SkillCheck) =>
    check.skill ? `${check.skill} (${check.ability})` : check.ability;

  const formatChecks = (checks: SkillCheck[]) =>
    checks
      .map((check) => `${formatCheckName(check)} DC ${check.dc}`)
      .join(" oder ");

  const formatChoiceDescription = (choice: Choice) => {
    return choice.description
      .replace(/^Du nimmst/, `${actorName} nimmt`)
      .replace(/^Du willst/, `${actorName} will`)
      .replace(/^Du beobachtest/, `${actorName} beobachtet`)
      .replace(/^Du folgst/, `${actorName} folgt`)
      .replace(/^Du akzeptierst/, `${actorName} akzeptiert`)
      .replace(/^Du nutzt/, `${actorName} nutzt`)
      .replace(/^Du sammelst/, `${actorName} sammelt`)
      .replace(/^Du lässt/, `${actorName} lässt`)
      .replace(/^Du merkst/, `${actorName} merkt`)
      .replace(/^Du trittst/, `${actorName} tritt`);

  };

  const renderChoiceButton = (choice: Choice) => {
    const checks = getChoiceChecks(choice);
    const hasChecks = checks.length > 0;
    const isCheckDropdownOpen = openChoiceCheckId === choice.id;
    const runChoiceCheck = (check: SkillCheck) => {
      const skillName = check.skill ?? check.ability;
      const skillModifier =
        activeSheet?.skills.find(([label]) => label === skillName)?.[1] ?? "+0";

      setPendingCheck({ choice, checks });
      setOpenChoiceCheckId(null);
      rollFormula(`${actorName} ${skillName}`, `1d20${skillModifier}`, {
        pendingCheckOverride: { choice, checks },
        skill: skillName,
      });
    };

    return (
      <div
        className="group relative"
        key={choice.id}
      >
        <button
          className="w-full rounded-md border border-white/10 bg-white/[0.06] px-3 py-3 pr-11 text-left text-sm text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15 focus-visible:border-ember-300 focus-visible:outline-none"
          onClick={() => {
            setOpenChoiceCheckId(null);
            chooseAction(choice);
          }}
          type="button"
        >
          <span className="block min-w-0 font-semibold">{choice.label}</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-400">
            {formatChoiceDescription(choice)}
          </span>
        </button>

        {hasChecks ? (
          <button
            aria-expanded={isCheckDropdownOpen}
            aria-label={`Skillchecks für ${choice.label} anzeigen`}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-md border border-ember-400/45 bg-ember-500/15 text-ember-100 transition hover:border-ember-300 hover:bg-ember-500/25 focus-visible:border-ember-300 focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation();
              setOpenChoiceCheckId((currentId) =>
                currentId === choice.id ? null : choice.id,
              );
            }}
            type="button"
          >
            <ChevronDown
              className={`size-4 transition ${
                isCheckDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : null}

        {hasChecks ? (
          <div
            className={`absolute right-0 top-12 z-50 w-52 max-w-[calc(100%-0.75rem)] origin-top-right rounded-md border border-ember-400/60 bg-ink-950 p-2 text-xs text-slate-200 shadow-2xl ring-1 ring-black/50 ${
              isCheckDropdownOpen
                ? "block"
                : "hidden group-hover:block group-focus-within:block"
            }`}
          >
            <p className="mb-2 text-right font-bold uppercase tracking-[0.12em] text-ember-200">
              Skillchecks
            </p>
            <div className="space-y-1.5">
              {checks.map((check) => (
                <button
                  className="flex w-full items-center justify-between gap-2 rounded border border-white/10 bg-white/[0.08] px-2 py-1.5 text-left font-semibold text-slate-100 transition hover:border-ember-300/80 hover:bg-ember-500/20 focus-visible:border-ember-300 focus-visible:outline-none"
                  key={`${choice.id}-${check.ability}-${check.skill ?? "ability"}-${check.dc}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    runChoiceCheck(check);
                  }}
                  type="button"
                >
                  <span className="min-w-0 truncate">{formatCheckName(check)}</span>
                  <span className="shrink-0 rounded bg-ember-500/20 px-1.5 py-0.5 text-ember-100">
                    DC {check.dc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const buildLocalDmAnswer = (question: string) => {
    const options = currentScene.choices
      .map((choice) => choice.label)
      .join(", ");

    return [
      `Aktuelle Szene: ${currentScene.title}.`,
      currentScene.narration,
      options
        ? `Mögliche nächste Schritte: ${options}.`
        : "Aktuell gibt es keine offene Spieleroption.",
      `Deine Frage: ${question}`,
    ].join(" ");
  };

  const shouldUseLocalDmAnswer = (narration: string) =>
    narration.includes("Die Szene reagiert auf deine Entscheidung") ||
    narration.startsWith(`${currentScene.title}:`);

  const persistSaveState = (
    sceneId: string,
    characterId: CharacterId,
    choiceLabel: string,
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const targetScene = findScene(sceneId);
    const saveState: SaveState = {
      id: createId(),
      campaignTitle: CAMPAIGN_TITLE,
      sessionTitle: targetScene.chapter,
      sceneId,
      sceneTitle: targetScene.title,
      characterId,
      choiceLabel,
      createdAt: new Date().toISOString(),
    };
    const currentSaveStates = readSaveStates();
    const campaignSaves = currentSaveStates
      .filter((item) => item.campaignTitle === CAMPAIGN_TITLE)
      .slice(0, MAX_CAMPAIGN_SAVES - 1);
    const otherCampaignSaves = currentSaveStates.filter(
      (item) => item.campaignTitle !== CAMPAIGN_TITLE,
    );
    const nextSaveStates = [
      saveState,
      ...campaignSaves,
      ...otherCampaignSaves,
    ].slice(0, MAX_ACCOUNT_SAVES);

    window.localStorage.setItem(SAVE_KEY, JSON.stringify(nextSaveStates));
    window.localStorage.setItem(LAST_SAVE_KEY, JSON.stringify(saveState));
  };

  const goToScene = (sceneId: string) => {
    if (sceneId === "kampf-initiative-start" && currentSceneId !== sceneId) {
      const advantageNames = (["ryu", "ayane"] as CharacterId[])
        .filter((characterId) => initiativeRollModes[characterId] === "advantage")
        .map((characterId) => characters[characterId].name);

      setInitiativeRolls({});
      setInitiativeOrder([]);
      setCombatRoundState(createInitialCombatRoundState());
      setInitiativeStatus(
        advantageNames.length > 0
          ? `Initiative offen: Ryu und Ayane müssen würfeln. ${advantageNames.join(
              " und ",
            )} würfelt mit Vorteil.`
          : "Initiative offen: Ryu und Ayane müssen würfeln.",
      );
    }

    setCurrentSceneId(sceneId);
    setDialogueLineIndex(0);
    setVisibleWordCount(0);
  };

  const selectCharacter = (characterId: CharacterId) => {
    setSelectedCharacterId(characterId);
    persistSaveState(
      "prolog-das-gestohlene-ei",
      characterId,
      `${characters[characterId].name} gewählt`,
    );
    goToScene("prolog-das-gestohlene-ei");
  };

  const chooseAction = (choice: Choice) => {
    const checks = getChoiceChecks(choice);

    if (checks.length > 0) {
      setPendingCheck({ choice, checks });
      const dmHint = `${actorName} versucht: ${choice.label}. Bitte würfle ${formatChecks(checks)} im Charakterbogen.`;

      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: dmHint,
        },
      ]);
      addGameLog({
        title: "Skillcheck wartet",
        detail: dmHint,
      });
      return;
    }

    if (selectedCharacterId) {
      persistSaveState(choice.nextSceneId, selectedCharacterId, choice.label);
    }

    goToScene(choice.nextSceneId);
  };

  const advanceCombatTurn = () => {
    setCombatRoundState((currentState) => {
      const order = currentState.initiativeOrder;

      if (order.length === 0 || currentState.round === 0) {
        return currentState;
      }

      const nextTurnIndex = (currentState.turnIndex + 1) % order.length;
      const isNewRound = nextTurnIndex === 0;
      const nextRound = isNewRound ? currentState.round + 1 : currentState.round;
      const nextActor = order[nextTurnIndex];

      setSelectedCombatTargetId(null);
      setCombatAttackFlowState(
        createCombatAttackFlowStateForActor(nextActor, nextRound),
      );

      return {
        ...currentState,
        round: nextRound,
        activeActorId: nextActor?.id ?? null,
        turnIndex: nextTurnIndex,
        awaitingRoll: null,
      };
    });
  };

  const resolveBackendCombatTurn = async (targetId?: string) => {
    if (!activeCombatActor || isBackendTurnResolving) {
      return;
    }

    setIsBackendTurnResolving(true);
    setCombatStatus("Backend loest den aktuellen Kampfrunden-Zug auf...");

    try {
      await syncBackendSave();
      const target =
        activeCombatActor.kind === "enemy"
          ? undefined
          : availableCombatTargets.find((item) => item.id === targetId) ??
            selectedCombatTarget;
      const needsHeroTarget = activeCombatActor.kind !== "enemy";

      if (needsHeroTarget && !target) {
        setCombatStatus("Bitte zuerst ein Ziel fuer den Angriff auswaehlen.");
        setCombatAttackFlowState({
          actorId: activeCombatActor.id,
          actionName: null,
          attackFormula: null,
          damageFormula: null,
          targetId: null,
          attackTotal: null,
          attackHit: null,
          step: "chooseAction",
        });
        return;
      }

      setCombatAttackFlowState({
        actorId: activeCombatActor.id,
        actionName: null,
        attackFormula: null,
        damageFormula: null,
        targetId: target?.id ?? null,
        attackTotal: null,
        attackHit: null,
        step:
          activeCombatActor.kind === "enemy"
            ? "enemyResolving"
            : "awaitAttackRoll",
      });

      const action: EncounterAutoTurnAction | undefined =
        activeCombatActor.kind === "enemy"
          ? undefined
          : target
            ? {
                action_type: "attack",
                actor_id:
                  activeCombatActor.kind === "player"
                    ? toBackendCharacterId(activeCharacter?.id ?? "ryu")
                    : toBackendCharacterId(activeNpc?.id ?? "ayane"),
                target_id: target.id,
              }
            : undefined;

      const response = await resolveSaveEncounterAutoTurn(
        BACKEND_SLOT_NAME,
        action,
      );

      setInventoryState(response.state.inventory);
      applyFrontendEncounterState(response.frontend_state);
      setSelectedCombatTargetId(null);
      setCombatAttackFlowState({
        actorId:
          response.frontend_state.lastResolution?.actorId ??
          response.frontend_state.activeActorId,
        actionName: null,
        attackFormula: null,
        damageFormula: null,
        targetId: response.frontend_state.lastResolution?.targetId ?? null,
        attackTotal: response.frontend_state.lastResolution?.attack?.total ?? null,
        attackHit: response.frontend_state.lastResolution?.attack?.hit ?? null,
        step:
          activeCombatActor.kind !== "enemy" &&
          response.frontend_state.lastResolution?.attack?.hit === true
            ? "awaitDamageRoll"
            : response.frontend_state.lastResolution
              ? "turnResolved"
              : response.frontend_state.turnControl?.requiresPlayerAction
                ? "chooseAction"
                : response.frontend_state.turnControl?.autoResolvable
                  ? "enemyResolving"
                  : "idle",
      });
      setCombatStatus(
        response.frontend_state.lastResolution
          ? "Backend-Zug aufgeloest. HUD und Kampfrunde wurden aktualisiert."
          : "Backend-Zug verarbeitet. Kampfrunde wurde aktualisiert.",
      );
    } catch (error) {
      setCombatStatus(
        "Backend-Auto-Turn nicht erreichbar. Zug bleibt unveraendert.",
      );
      addGameLog({
        title: "Backend-Auto-Turn fehlgeschlagen",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsBackendTurnResolving(false);
    }
  };

  const rollCombatAttack = async () => {
    if (
      !activeCombatActor ||
      !selectedCombatTarget ||
      !combatAttackFlowState.actionName ||
      isBackendTurnResolving
    ) {
      return;
    }

    setIsBackendTurnResolving(true);
    setCombatStatus("Backend wuerfelt den Angriff gegen die Ziel-AC...");

    try {
      await syncBackendSave();
      const action: EncounterAutoTurnAction = {
        action_type: "attack",
        actor_id:
          activeCombatActor.kind === "player"
            ? toBackendCharacterId(activeCharacter?.id ?? "ryu")
            : toBackendCharacterId(activeNpc?.id ?? "ayane"),
        target_id: selectedCombatTarget.id,
      };
      const response = await resolveSaveEncounterAttackRoll(
        BACKEND_SLOT_NAME,
        action,
      );
      const attack = response.frontend_state.lastResolution?.attack ?? null;
      const targetName = getCombatActorName(
        response.frontend_state.lastResolution?.targetId ??
          selectedCombatTarget.id,
      );
      const requiresDamageRoll =
        response.frontend_state.turnControl?.requiresDamageRoll === true ||
        Boolean(response.frontend_state.pendingDamage);

      setInventoryState(response.state.inventory);
      applyFrontendEncounterState(response.frontend_state);
      setCombatAttackFlowState((currentState) => ({
        ...currentState,
        actorId:
          response.frontend_state.lastResolution?.actorId ??
          response.frontend_state.activeActorId,
        targetId:
          response.frontend_state.lastResolution?.targetId ??
          selectedCombatTarget.id,
        attackTotal: attack?.total ?? null,
        attackHit: attack?.hit ?? null,
        damageTotal: null,
        remainingHp: null,
        step: requiresDamageRoll ? "awaitDamageRoll" : "turnResolved",
      }));
      setCombatStatus(
        attack
          ? `${attack.total ?? "?"} gegen AC ${attack.targetAc ?? "?"}: ${
              attack.hit
                ? "Treffer. Backend wartet auf Damage Roll."
                : "Verfehlt. Kein Damage Roll."
            }`
          : "Backend hat den Angriff verarbeitet.",
      );
      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: attack?.hit
            ? `${activeCombatActor.name} trifft ${targetName} mit ${combatAttackFlowState.actionName}. Bitte wuerfle jetzt den Schaden.`
            : `${activeCombatActor.name} verfehlt ${targetName} mit ${combatAttackFlowState.actionName}. Der Zug kann beendet werden.`,
        },
      ]);
    } catch (error) {
      setCombatStatus("Backend-Attack-Roll nicht erreichbar.");
      addGameLog({
        title: "Backend-Attack-Roll fehlgeschlagen",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsBackendTurnResolving(false);
    }
  };

  const rollCombatDamage = async () => {
    if (
      !activeCombatActor ||
      !combatAttackFlowState.targetId ||
      !combatAttackFlowState.actionName ||
      !canResolveBackendDamageRoll ||
      isBackendTurnResolving
    ) {
      return;
    }

    setIsBackendTurnResolving(true);
    setCombatStatus("Backend wuerfelt den Schaden und aktualisiert HP...");

    try {
      const response = await resolveSaveEncounterDamageRoll(BACKEND_SLOT_NAME);
      const resolution = response.frontend_state.lastResolution;
      const damageTotal = resolution?.damage?.total ?? null;
      const remainingHp = resolution?.hp?.remainingHp ?? null;
      const targetName = getCombatActorName(
        resolution?.targetId ?? combatAttackFlowState.targetId,
      );

      setInventoryState(response.state.inventory);
      applyFrontendEncounterState(response.frontend_state);
      setSelectedCombatTargetId(null);
      setCombatAttackFlowState((currentState) => ({
        ...currentState,
        actorId: resolution?.actorId ?? response.frontend_state.activeActorId,
        targetId: resolution?.targetId ?? currentState.targetId,
        damageTotal,
        remainingHp,
        step: "turnResolved",
      }));
      setCombatStatus(
        damageTotal !== null
          ? `${combatAttackFlowState.actionName} verursacht ${damageTotal} Schaden. ${targetName}: HP ${remainingHp ?? "?"}.`
          : "Backend hat den Schaden verarbeitet.",
      );
      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text:
            damageTotal !== null
              ? `${activeCombatActor.name} verursacht ${damageTotal} Schaden mit ${combatAttackFlowState.actionName}. ${targetName} hat noch ${
                  remainingHp ?? "?"
                } HP.`
            : "Der Schaden wurde vom Backend verarbeitet.",
        },
      ]);
    } catch (error) {
      setCombatStatus("Backend-Damage-Roll nicht erreichbar.");
      addGameLog({
        title: "Backend-Damage-Roll fehlgeschlagen",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsBackendTurnResolving(false);
    }
  };

  const endPlayerCombatTurn = () => {
    if (combatAttackFlowState.step !== "turnResolved") {
      return;
    }

    advanceCombatTurn();
  };

  const continueDialogue = () => {
    if (!isDialogueFullyVisible) {
      setVisibleWordCount(dialogueWords.length);
      return;
    }

    if (!isLastDialogueLine) {
      setDialogueLineIndex((currentIndex) => currentIndex + 1);
      setVisibleWordCount(0);
    }
  };

  const rollManualDice = () => {
    const rollOnce = () => Math.floor(Math.random() * diceType) + 1;
    const rolls =
      diceType === 20 && rollMode !== "normal"
        ? [rollOnce(), rollOnce()]
        : [rollOnce()];
    const selectedRoll =
      rollMode === "advantage"
        ? Math.max(...rolls)
        : rollMode === "disadvantage"
          ? Math.min(...rolls)
          : rolls[0];

    const result = {
      diceType,
      rolls,
      selectedRoll,
      modifier: rollModifier,
      total: selectedRoll + rollModifier,
      mode: rollMode,
      label: `d${diceType}`,
    };

    setRollResult(result);
    setRollAnimationKey((currentKey) => currentKey + 1);
    addGameLog({
      title: `${result.label} gewürfelt`,
      detail:
        rolls.length > 1
          ? `Würfe ${rolls.join(" / ")} · ${rollMode === "advantage" ? "Vorteil" : "Nachteil"} · Ergebnis ${result.total}`
          : `Wurf ${rolls[0]} + Mod ${rollModifier} · Ergebnis ${result.total}`,
      total: result.total,
    });
  };

  const rollFormula = (
    label: string,
    formula: string,
    options?: {
      skill?: string;
      initiativeCharacterId?: CharacterId;
      pendingCheckOverride?: PendingCheck;
      rollMode?: RollMode;
    },
  ) => {
    const parsedFormula = parseDiceFormula(formula);

    if (!parsedFormula) {
      return;
    }

    const {
      diceCount,
      diceType: formulaDiceType,
      modifier,
    } = parsedFormula;
    const rollOnce = () => Math.floor(Math.random() * formulaDiceType) + 1;
    const effectiveRollMode =
      options?.initiativeCharacterId && formulaDiceType === 20
        ? initiativeRollModes[options.initiativeCharacterId] ?? "normal"
        : options?.rollMode ?? "normal";
    const rolls =
      diceCount === 1 && formulaDiceType === 20 && effectiveRollMode !== "normal"
        ? [rollOnce(), rollOnce()]
        : Array.from({ length: diceCount }, rollOnce);
    const selectedRoll =
      diceCount === 1 && formulaDiceType === 20 && effectiveRollMode === "advantage"
        ? Math.max(...rolls)
        : diceCount === 1 &&
            formulaDiceType === 20 &&
            effectiveRollMode === "disadvantage"
          ? Math.min(...rolls)
          : rolls.reduce((sum, roll) => sum + roll, 0);
    const result = {
      diceType: formulaDiceType,
      rolls,
      selectedRoll,
      modifier,
      total: selectedRoll + modifier,
      mode: effectiveRollMode,
      label,
    };

    setRollResult(result);
    setRollAnimationKey((currentKey) => currentKey + 1);
    addGameLog({
      title: label,
      detail:
        rolls.length > 1
          ? `Würfe ${rolls.join(" / ")} · ${
              effectiveRollMode === "advantage" ? "Vorteil" : "Nachteil"
            } · Mod ${modifier} · Ergebnis ${result.total}`
          : `Wurf ${rolls.join(" + ")} + Mod ${modifier} · Ergebnis ${result.total}`,
      total: result.total,
    });

    if (options?.initiativeCharacterId && isInitiativeScene) {
      const initiativeCharacterId = options.initiativeCharacterId;
      const nextInitiativeRolls = {
        ...initiativeRolls,
        [initiativeCharacterId]: result.total,
      };
      setInitiativeRollModes((modes) => ({
        ...modes,
        [initiativeCharacterId]: "normal",
      }));
      const missingCharacters = (["ryu", "ayane"] as CharacterId[]).filter(
        (characterId) => nextInitiativeRolls[characterId] === undefined,
      );

      setInitiativeRolls(nextInitiativeRolls);

      if (missingCharacters.length > 0) {
        const missingNames = missingCharacters
          .map((characterId) => characters[characterId].name)
          .join(" und ");

        setInitiativeStatus(`Noch offen: ${missingNames}.`);
        setDmMessages((messages) => [
          ...messages,
          {
            id: createId(),
            sender: "DM",
            text: `${characters[initiativeCharacterId].name} ist in der Initiative. Bitte würfle noch ${missingNames}.`,
          },
        ]);
        return;
      }

      const enemyInitiatives = [
        {
          id: "shadow-raider-1",
          name: "Schattenräuber A",
          kind: "enemy" as const,
          roll: Math.floor(Math.random() * 20) + 1 + 2,
        },
        {
          id: "shadow-raider-2",
          name: "Schattenräuber B",
          kind: "enemy" as const,
          roll: Math.floor(Math.random() * 20) + 1 + 2,
        },
      ];
      const orderedInitiativeActors = [
        ...(Object.entries(nextInitiativeRolls) as [CharacterId, number][]).map(
          ([characterId, total]) => ({
            id: characterId,
            name: characters[characterId].name,
            kind:
              characterId === selectedCharacterId
                ? ("player" as const)
                : ("companion" as const),
            total,
            roll: total,
          }),
        ),
        ...enemyInitiatives,
      ].sort((firstActor, secondActor) => secondActor.roll - firstActor.roll);
      const visibleInitiativeOrder = orderedInitiativeActors
        .map((actor) =>
          actor.kind === "enemy" ? actor.name : `${actor.name} ${actor.total}`,
        )
        .join(", ");
      const combatInitiativeOrder: InitiativeActor[] = orderedInitiativeActors.map(
        (actor) => ({
          id: actor.id,
          name: actor.name,
          kind: actor.kind,
          total: "total" in actor ? actor.total : undefined,
        }),
      );

      setInitiativeOrder(combatInitiativeOrder);
      setCombatRoundState((currentState) => ({
        ...currentState,
        round: 1,
        activeActorId: combatInitiativeOrder[0]?.id ?? null,
        turnIndex: 0,
        initiativeOrder: combatInitiativeOrder,
        awaitingRoll: null,
      }));
      setInitiativeStatus(`Initiative steht: ${visibleInitiativeOrder}.`);
      addGameLog({
        title: "Initiative vollständig",
        detail: `${visibleInitiativeOrder}. Gegner wurden verdeckt vom DM gewürfelt.`,
      });
      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: `Initiative steht: ${visibleInitiativeOrder}. Die Gegnerwürfe bleiben verdeckt, die Reihenfolge ist offen.`,
        },
      ]);

      window.setTimeout(() => {
        if (selectedCharacterId) {
          persistSaveState(
            "kampf-runde-eins",
            selectedCharacterId,
            "Initiative vollständig",
          );
        }

        goToScene("kampf-runde-eins");
      }, 900);
      return;
    }

    const activePendingCheck = options?.pendingCheckOverride ?? pendingCheck;

    if (!activePendingCheck || !options?.skill) {
      return;
    }

    const matchingCheck = activePendingCheck.checks.find(
      (check) => (check.skill ?? check.ability) === options.skill,
    );

    if (!matchingCheck) {
      return;
    }

    const naturalRoll = rolls[0];
    const success = naturalRoll === 20 || result.total >= matchingCheck.dc;
    const targetSceneId =
      naturalRoll === 20
        ? activePendingCheck.choice.natural20SceneId ??
          activePendingCheck.choice.nextSceneId
        : naturalRoll === 1
          ? activePendingCheck.choice.natural1SceneId ??
            activePendingCheck.choice.failureSceneId ??
            activePendingCheck.choice.nextSceneId
          : success
            ? activePendingCheck.choice.nextSceneId
            : activePendingCheck.choice.failureSceneId ??
              activePendingCheck.choice.nextSceneId;
    const checkDetail =
      naturalRoll === 20
        ? `Natural 20: ${options.skill} gegen DC ${matchingCheck.dc} automatisch stark geschafft.`
        : naturalRoll === 1
          ? `Natural 1: ${options.skill} gegen DC ${matchingCheck.dc} kritisch verfehlt.`
          : `${options.skill} ${result.total} gegen DC ${matchingCheck.dc}: ${
              success ? "geschafft" : "nicht geschafft"
            }.`;

    if (naturalRoll === 20 && selectedCharacterId) {
      setInitiativeRollModes((modes) => ({
        ...modes,
        [selectedCharacterId]: "advantage",
      }));
    }

    addGameLog({
      title: "Skillcheck ausgewertet",
      detail: checkDetail,
      total: result.total,
    });
    setDmMessages((messages) => [
      ...messages,
      {
        id: createId(),
        sender: "DM",
        text: checkDetail,
      },
    ]);
    setPendingCheck(null);

    window.setTimeout(() => {
    if (selectedCharacterId) {
        persistSaveState(targetSceneId, selectedCharacterId, activePendingCheck.choice.label);
    }

      goToScene(targetSceneId);
    }, 900);
  };

  const runBackendCombatTest = async () => {
    if (!selectedCharacterId || !activeSheet) {
      setCombatStatus("Bitte zuerst Ryu oder Ayane auswählen.");
      return;
    }

    const action = activeSheet.actions[0];
    const damageFormula = parseDiceFormula(action.damage);

    if (!damageFormula) {
      setCombatStatus(`Schadensformel für ${action.name} konnte nicht gelesen werden.`);
      return;
    }

    const targetHp = combatTargetHp > 0 ? combatTargetHp : 20;
    setCombatStatus(
      `${action.name} gegen Trainingsziel wird vom Backend ausgewertet...`,
    );

    try {
      const response = await resolveCombat({
        character_id: toBackendCharacterId(selectedCharacterId),
        attack_modifier: action.attack,
        target_ac: 14,
        damage_dice_count: damageFormula.diceCount,
        damage_die_sides: damageFormula.diceType,
        damage_modifier: damageFormula.modifier,
        target_current_hp: targetHp,
      });
      const events = buildCombatHudEvents(response);
      const hitText = response.attack.hit ? "Treffer" : "verfehlt";
      const hpText = response.attack.hit
        ? `Schaden ${response.damage.total}, Ziel-HP ${response.hp.remaining_hp}.`
        : "Kein Schaden.";

      setCombatTargetHp(response.attack.hit ? response.hp.remaining_hp : targetHp);
      setCombatStatus(
        `${action.name}: ${response.attack.total} gegen AC 14, ${hitText}. ${hpText}`,
      );
      applyHudEvents(events);
    } catch (error) {
      setCombatStatus(
        error instanceof Error
          ? error.message
          : "Backend-Combat konnte nicht ausgewertet werden.",
      );
    }
  };

  const sendDmHelpMessage = async (message: string) => {
    const trimmedInput = message.trim();

    if (!trimmedInput) {
      return;
    }

    setDmMessages((messages) => [
      ...messages,
      {
        id: createId(),
        sender: "Spieler",
        text: trimmedInput,
      },
    ]);
    setDmInput("");

    try {
      const response = await askAiDmHelp({
        message: trimmedInput,
        slot_name: BACKEND_SLOT_NAME,
        scene_context: {
          id: currentScene.id,
          title: currentScene.title,
          chapter: currentScene.chapter,
        },
        rules_result: {
          scene: currentScene.id,
          last_roll: rollResult,
        },
        character_state: backendSaveState.main_character,
        inventory: inventoryState,
      });

      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: response.answer,
          command: response.command,
          topics: response.topics,
          allowedScope: response.allowed_scope,
          stateLocked: response.state_locked,
        },
      ]);
    } catch (error) {
      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: "Backend-DM ist lokal noch nicht erreichbar. Starte FastAPI auf Port 8000, dann wird diese Frage an /ai-dm/help gesendet.",
        },
      ]);
      addGameLog({
        title: "AI-DM nicht erreichbar",
        detail: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  };

  const sendDmMessage = async () => {
    const trimmedInput = dmInput.trim();

    if (!trimmedInput) {
      return;
    }

    await sendDmHelpMessage(trimmedInput);
  };

  useEffect(() => {
    void syncInventoryView();
  }, [inventoryState]);

  useEffect(() => {
    void syncBackendSave();
  }, [backendSaveState, currentSceneId, selectedCharacterId]);

  useEffect(() => {
    setVisibleWordCount(0);
  }, [currentSceneId, dialogueLineIndex]);

  useEffect(() => {
    if (isCharacterSelection || isDialogueFullyVisible) {
      return;
    }

    const revealTimer = window.setTimeout(() => {
      setVisibleWordCount((currentCount) =>
        Math.min(currentCount + 1, dialogueWords.length),
      );
    }, WORD_REVEAL_MS);

    return () => window.clearTimeout(revealTimer);
  }, [
    dialogueWords.length,
    isCharacterSelection,
    isDialogueFullyVisible,
    visibleWordCount,
  ]);

  return (
    <main className="min-h-dvh overflow-y-auto px-3 py-3 text-slate-50 sm:px-4 lg:h-dvh lg:overflow-hidden lg:px-5">
      <section className="mx-auto flex min-h-dvh w-full max-w-[100rem] flex-col gap-3 lg:h-full lg:min-h-0">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ember-400">
              Falkenwacht MVP
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">
              {currentScene.title}
            </h1>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <Link
              className="flex items-center gap-2 rounded-md border border-ember-400/30 bg-ink-950/70 px-3 py-2 shadow-glow transition hover:border-ember-400/70 hover:bg-ember-500/15"
              href="/campaigns"
              title="Kampagnenportal öffnen"
            >
              <ShieldCheck className="size-4 text-ember-400" />
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                  Kampagnenportal
                </p>
                <p className="text-xs font-semibold text-slate-100">
                  Kampagnen & Speicherstände
                </p>
              </div>
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
              href="/login"
              title="Zum Login"
            >
              <LogIn className="size-4" />
              Login
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
              href="/login"
              title="Zur Registrierung"
            >
              <UserPlus className="size-4" />
              Registrieren
            </Link>
            <button
              aria-label="DM-Chat öffnen"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-bold text-slate-100 shadow-glow transition hover:border-ember-400/70 hover:bg-ember-500/15"
              onClick={() => setIsDmPanelOpen((isOpen) => !isOpen)}
              title="DM-Chat öffnen"
              type="button"
            >
              <Bot className="size-5" />
              DM
            </button>
            <button
              aria-label="Game-Log öffnen"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-bold text-slate-100 shadow-glow transition hover:border-ember-400/70 hover:bg-ember-500/15"
              onClick={() => setIsLogPanelOpen((isOpen) => !isOpen)}
              title="Game-Log öffnen"
              type="button"
            >
              <ClipboardList className="size-5" />
              Log
            </button>
            {isLogPanelOpen ? (
              <div className="absolute right-0 top-14 z-50 max-h-96 w-96 overflow-y-auto rounded-md border border-white/10 bg-ink-950/95 p-3 shadow-2xl">
                <p className="mb-3 text-sm font-bold">Game-Log</p>
                <div className="space-y-2">
                  {gameLog.map((entry) => (
                    <article
                      className="rounded-md border border-white/10 bg-white/[0.06] p-2 text-sm"
                      key={entry.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold text-slate-100">
                          {entry.title}
                        </p>
                        {entry.total !== undefined ? (
                          <span className="rounded-sm bg-ember-500 px-2 py-1 text-xs font-black text-ink-950">
                            {entry.total}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {entry.detail}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {false ? (
              <div className="absolute right-0 top-14 z-50 w-80 rounded-md border border-white/10 bg-ink-950/95 p-3 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-100">Würfel</p>
                  <button
                    aria-label="Würfelfenster schließen"
                    className="grid size-7 place-items-center rounded-md border border-white/10 bg-white/10"
                    onClick={() => setIsDicePanelOpen(false)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {diceTypes.map((item) => (
                    <button
                      className={`rounded-md border px-2 py-2 text-xs font-bold transition ${
                        diceType === item
                          ? "border-ember-400 bg-ember-500 text-ink-950"
                          : "border-white/10 bg-white/[0.06] text-slate-100 hover:border-ember-400/70"
                      }`}
                      key={item}
                      onClick={() => setDiceType(item)}
                      type="button"
                    >
                      d{item}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["normal", "advantage", "disadvantage"] as RollMode[]).map(
                    (mode) => (
                      <button
                        className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                          rollMode === mode
                            ? "border-ember-400 bg-ember-500 text-ink-950"
                            : "border-white/10 bg-white/[0.06] text-slate-100 hover:border-ember-400/70"
                        }`}
                        disabled={diceType !== 20 && mode !== "normal"}
                        key={mode}
                        onClick={() => setRollMode(mode)}
                        type="button"
                      >
                        {mode === "normal"
                          ? "Normal"
                          : mode === "advantage"
                            ? "Vorteil"
                            : "Nachteil"}
                      </button>
                    ),
                  )}
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Modifikator
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-100 outline-none"
                    onChange={(event) =>
                      setRollModifier(Number(event.target.value) || 0)
                    }
                    type="number"
                    value={rollModifier}
                  />
                </label>

                <button
                  className="mt-3 h-10 w-full rounded-md border border-ember-400/50 bg-ember-500 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
                  onClick={rollManualDice}
                  type="button"
                >
                  Würfeln
                </button>

                {rollResult ? (
                  <div className="mt-3 rounded-md border border-white/10 bg-black/35 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                      Letzter Wurf
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {rollResult?.total}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {rollResult?.label}: {rollResult?.rolls.join(" / ")}
                      {" + "}
                      Mod {rollResult?.modifier}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <div className="hidden rounded-md border border-white/10 bg-white/[0.06] p-2">
          <BookOpen className="mb-1 size-4 text-ember-400" />
          <p className="text-xs text-slate-400">Aktuelle Szene</p>
          <p className="text-sm font-semibold">
            {currentScene.chapter} · {currentScene.title}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)_minmax(12rem,15rem)] xl:grid-cols-[20rem_minmax(0,1fr)_15rem]">
          <aside className="relative z-30 max-h-[32rem] min-h-0 overflow-y-auto rounded-md border border-white/10 bg-ink-950/70 p-3 lg:max-h-none">
            <div className="mb-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-left">
              <span>
                <span className="block text-xs uppercase tracking-[0.16em] text-ember-300">
                  Charakterbogen
                </span>
                <span className="block text-sm font-bold">
                  {activeCharacter?.name ?? "Noch kein Charakter"}
                </span>
              </span>
            </div>

            {activeCharacter &&
            activeNpc &&
            activeRuntimeStats &&
            companionRuntimeStats ? (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <article
                  className={`overflow-hidden rounded-md border border-ember-400/35 bg-white/[0.05] shadow-glow ${
                    isSheetExpanded ? "col-span-2" : ""
                  }`}
                >
                  <div className="flex h-32 items-end justify-center bg-gradient-to-b from-white/10 to-black/40">
                    <Image
                      alt={`${activeCharacter.name} Portrait`}
                      className="max-h-32 object-contain drop-shadow-2xl"
                      height={190}
                      src={activeCharacter.modelImageUrl}
                      width={150}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-white/10 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {activeCharacter.name}
                      </p>
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-ember-300">
                        Hauptcharakter
                      </p>
                    </div>
                    <button
                      aria-label={`${activeCharacter.name} Sheet umschalten`}
                      className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-ember-400/70"
                      onClick={() =>
                        setIsSheetExpanded((isExpanded) => !isExpanded)
                      }
                      type="button"
                    >
                      <ChevronDown
                        className={`size-4 transition ${
                          isSheetExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-1.5 text-center">
                    <span className="rounded bg-red-500/15 px-1 py-1 text-[0.62rem] font-bold text-red-100">
                      HP {activeRuntimeStats.currentHp}/{activeRuntimeStats.maxHp}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      AC {activeRuntimeStats.ac}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      SP {activeCharacter.stats.speed}
                    </span>
                  </div>
                  {isSheetExpanded && activeSheet ? (
                    <div className="space-y-2 border-t border-white/10 p-2">
                      <button
                        className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-2 py-2 text-left text-xs transition hover:border-ember-400"
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter.name} Initiative`,
                            `1d20+${activeCharacter.stats.initiative}`,
                            { initiativeCharacterId: activeCharacter.id },
                          )
                        }
                        type="button"
                      >
                        Initiative +{activeCharacter.stats.initiative}
                      </button>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Skills
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {activeSheet.skills.map(([label, value]) => (
                            <button
                              className={`min-w-0 rounded-md border px-2 py-1.5 text-left text-[0.68rem] transition hover:border-ember-400/70 ${
                                pendingSkillNames.has(label)
                                  ? "border-ember-400 bg-ember-500/20 shadow-glow"
                                  : "border-white/10 bg-white/[0.05]"
                              }`}
                              key={label}
                              onClick={() =>
                                rollFormula(
                                  `${activeCharacter.name} ${label}`,
                                  `1d20${value}`,
                                  { skill: label },
                                )
                              }
                              type="button"
                            >
                              <span className="block truncate text-slate-300">
                                {label}
                              </span>
                              <span className="font-bold text-slate-100">
                                {value}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Aktionen
                        </p>
                        <div className="grid gap-1">
                        {activeSheet.actions.map((action) => (
                          <div
                            className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                            key={action.name}
                          >
                            <p className="truncate text-xs font-bold">
                              {action.name}
                            </p>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-1 py-1.5 text-[0.65rem] transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(
                                    `${action.name} Angriff`,
                                    `1d20+${action.attack}`,
                                  )
                                }
                                type="button"
                              >
                                <span className="block text-[0.55rem] uppercase tracking-[0.12em] text-slate-400">
                                  Hit
                                </span>
                                <span className="font-bold">+{action.attack}</span>
                              </button>
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-1 py-1.5 text-[0.65rem] transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(`${action.name} Schaden`, action.damage)
                                }
                                type="button"
                              >
                                <span className="block text-[0.55rem] uppercase tracking-[0.12em] text-slate-400">
                                  Damage
                                </span>
                                <span className="font-bold">{action.damage}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Inventory
                        </p>
                        <div className="space-y-1">
                          {inventoryItems.length > 0 ? (
                            inventoryItems.map((item) => (
                              <article
                                className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                                key={item.item_id}
                              >
                                <p className="truncate text-xs font-bold">
                                  {item.name}
                                </p>
                                <p className="text-[0.65rem] text-slate-500">
                                  Menge {item.quantity}
                                  {item.equipped ? " · ausgerüstet" : ""}
                                </p>
                                <div className="mt-1 grid grid-cols-2 gap-1">
                                  {(item.actions ?? []).slice(0, 4).map((action) => (
                                    <button
                                      className="rounded-md border border-white/10 bg-white/[0.06] px-1 py-1.5 text-[0.65rem] font-semibold transition hover:border-ember-400/70"
                                      key={action}
                                      onClick={() =>
                                        handleInventoryAction(item, action)
                                      }
                                      type="button"
                                    >
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              </article>
                            ))
                          ) : (
                            <p className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-[0.68rem] text-slate-400">
                              Inventory wird vom Backend geladen.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>

                <article
                  className={`overflow-hidden rounded-md border border-white/10 bg-white/[0.05] ${
                    isCompanionExpanded ? "col-span-2" : ""
                  }`}
                >
                  <div className="flex h-32 items-end justify-center bg-gradient-to-b from-white/10 to-black/40">
                    <Image
                      alt={`${activeNpc.name} Portrait`}
                      className="max-h-32 object-contain drop-shadow-2xl"
                      height={190}
                      src={activeNpc.modelImageUrl}
                      width={150}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-white/10 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{activeNpc.name}</p>
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">
                        Begleitung
                      </p>
                    </div>
                    <button
                      aria-label={`${activeNpc.name} Sheet umschalten`}
                      className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-ember-400/70"
                      onClick={() =>
                        setIsCompanionExpanded((isExpanded) => !isExpanded)
                      }
                      type="button"
                    >
                      <ChevronDown
                        className={`size-4 transition ${
                          isCompanionExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-1.5 text-center">
                    <span className="rounded bg-red-500/15 px-1 py-1 text-[0.62rem] font-bold text-red-100">
                      HP {companionRuntimeStats.currentHp}/{companionRuntimeStats.maxHp}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      AC {companionRuntimeStats.ac}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      SP {activeNpc.stats.speed}
                    </span>
                  </div>
                  {isCompanionExpanded && companionSheet ? (
                    <div className="space-y-2 border-t border-white/10 p-2">
                      <button
                        className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-2 py-2 text-left text-xs transition hover:border-ember-400"
                        onClick={() =>
                          rollFormula(
                            `${activeNpc.name} Initiative`,
                            `1d20+${activeNpc.stats.initiative}`,
                            { initiativeCharacterId: activeNpc.id },
                          )
                        }
                        type="button"
                      >
                        Initiative +{activeNpc.stats.initiative}
                      </button>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Aktionen
                        </p>
                        {companionSheet.actions.map((action) => (
                          <div
                            className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                            key={action.name}
                          >
                            <p className="truncate text-xs font-bold">
                              {action.name}
                            </p>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-1 py-1.5 text-[0.65rem] transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(
                                    `${activeNpc.name} ${action.name} Angriff`,
                                    `1d20+${action.attack}`,
                                  )
                                }
                                type="button"
                              >
                                <span className="block text-[0.55rem] uppercase tracking-[0.12em] text-slate-400">
                                  Hit
                                </span>
                                <span className="font-bold">+{action.attack}</span>
                              </button>
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-1 py-1.5 text-[0.65rem] transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(
                                    `${activeNpc.name} ${action.name} Schaden`,
                                    action.damage,
                                  )
                                }
                                type="button"
                              >
                                <span className="block text-[0.55rem] uppercase tracking-[0.12em] text-slate-400">
                                  Damage
                                </span>
                                <span className="font-bold">{action.damage}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>
            ) : null}

            {activeCharacter && activeSheet && isSheetExpanded ? (
              <div className="hidden space-y-3">
                <div className="hidden overflow-hidden rounded-md border border-white/10 bg-black/35">
                  <div className="flex h-40 items-end justify-center bg-gradient-to-b from-white/5 to-transparent">
                    <Image
                      alt={`${activeCharacter.name} Charakterbild`}
                      className="max-h-40 object-contain drop-shadow-2xl"
                      height={220}
                      src={activeCharacter.modelImageUrl}
                      width={180}
                    />
                  </div>
                  <div className="border-t border-white/10 p-2">
                    <p className="text-sm font-bold">{activeCharacter.name}</p>
                    <p className="text-xs text-slate-400">
                      Level {activeCharacter.level} {activeCharacter.className} ·{" "}
                      {activeCharacter.subclassName}
                    </p>
                  </div>
                </div>

                <div className="hidden grid-cols-3 gap-2">
                  <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                    <HeartPulse className="mb-1 size-4 text-ember-400" />
                    <p className="text-xs text-slate-400">HP</p>
                    <p className="text-sm font-bold">
                      {activeRuntimeStats?.currentHp} /{" "}
                      {activeRuntimeStats?.maxHp}
                    </p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                    <ShieldCheck className="mb-1 size-4 text-ember-400" />
                    <p className="text-xs text-slate-400">AC</p>
                    <p className="text-sm font-bold">
                      {activeRuntimeStats?.ac}
                    </p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                    <Swords className="mb-1 size-4 text-ember-400" />
                    <p className="text-xs text-slate-400">Speed</p>
                    <p className="text-sm font-bold">
                      {activeCharacter.stats.speed} ft.
                    </p>
                  </div>
                </div>

                <button
                  className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-left transition hover:border-ember-400"
                  onClick={() =>
                    rollFormula(
                      `${activeCharacter.name} Initiative`,
                      `1d20+${activeCharacter.stats.initiative}`,
                      { initiativeCharacterId: activeCharacter.id },
                    )
                  }
                  type="button"
                >
                  <span className="block text-xs text-slate-400">
                    Initiative würfeln
                  </span>
                  <span className="text-sm font-bold">
                    +{activeCharacter.stats.initiative}
                  </span>
                </button>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    Saving Throws
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {activeSheet.saves.map(([label, value]) => (
                      <button
                        className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-left text-xs transition hover:border-ember-400/70"
                        key={label}
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter.name} ${label}`,
                            `1d20${value}`,
                            { skill: label },
                          )
                        }
                        type="button"
                      >
                        <span className="text-slate-400">{label}</span>
                        <span className="float-right font-bold">{value}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    className="mb-2 flex w-full items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400"
                    onClick={() =>
                      setIsSkillsExpanded((isExpanded) => !isExpanded)
                    }
                    type="button"
                  >
                    Skills
                    <ChevronDown
                      className={`size-3 transition ${
                        isSkillsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isSkillsExpanded ? (
                  <div className="space-y-1">
                    {activeSheet.skills.map(([label, value]) => (
                      <button
                        className={`w-full rounded-md border px-2 py-2 text-left text-xs transition hover:border-ember-400/70 ${
                          pendingSkillNames.has(label)
                            ? "border-ember-400 bg-ember-500/20 shadow-glow"
                            : "border-white/10 bg-white/[0.05]"
                        }`}
                        key={label}
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter.name} ${label}`,
                            `1d20${value}`,
                            { skill: label },
                          )
                        }
                        type="button"
                      >
                        <span className="text-slate-300">{label}</span>
                        <span className="float-right font-bold text-slate-100">
                          {value}
                        </span>
                      </button>
                    ))}
                  </div>
                  ) : null}
                </div>

                <div>
                  <button
                    className="mb-2 flex w-full items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400"
                    onClick={() =>
                      setIsActionsExpanded((isExpanded) => !isExpanded)
                    }
                    type="button"
                  >
                    Aktionen
                    <ChevronDown
                      className={`size-3 transition ${
                        isActionsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isActionsExpanded ? (
                  <div className="space-y-2">
                    <button
                      className="w-full rounded-md border border-ember-400/50 bg-ember-500/10 px-3 py-2 text-left text-xs transition hover:border-ember-300 hover:bg-ember-500/20"
                      onClick={runBackendCombatTest}
                      type="button"
                    >
                      <span className="block font-bold text-slate-100">
                        Backend-Combat testen
                      </span>
                      <span className="block text-slate-400">
                        Trainingsziel AC 14 · HP {combatTargetHp > 0 ? combatTargetHp : 20}
                      </span>
                      <span className="mt-1 block text-slate-500">
                        {combatStatus}
                      </span>
                    </button>
                    {activeSheet.actions.map((action) => (
                      <div
                        className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                        key={action.name}
                      >
                        <p className="text-sm font-bold">{action.name}</p>
                        <p className="text-xs text-slate-500">{action.note}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-xs transition hover:border-ember-400/70"
                            onClick={() =>
                              rollFormula(
                                `${action.name} Angriff`,
                                `1d20+${action.attack}`,
                              )
                            }
                            type="button"
                          >
                            Angriff +{action.attack}
                          </button>
                          <button
                            className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-xs transition hover:border-ember-400/70"
                            onClick={() =>
                              rollFormula(
                                `${action.name} Schaden`,
                                action.damage,
                              )
                            }
                            type="button"
                          >
                            Schaden {action.damage}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  ) : null}
                </div>

                <div>
                  <button
                    className="mb-2 flex w-full items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400"
                    onClick={() =>
                      setIsInventoryExpanded((isExpanded) => !isExpanded)
                    }
                    type="button"
                  >
                    Inventory
                    <ChevronDown
                      className={`size-3 transition ${
                        isInventoryExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isInventoryExpanded ? (
                    <div className="space-y-2">
                      <p className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-xs text-slate-400">
                        {inventoryStatus}
                      </p>
                      {inventoryItems.map((item) => (
                        <article
                          className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                          key={item.item_id}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold">{item.name}</p>
                              <p className="text-xs text-slate-500">
                                {item.category ?? "item"} · Menge {item.quantity}
                                {item.equipped ? " · ausgerüstet" : ""}
                              </p>
                            </div>
                          </div>
                          {item.description ? (
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">
                              {getInventoryDescription(item)}
                            </p>
                          ) : null}
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {(item.actions ?? []).map((action) => (
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs font-semibold transition hover:border-ember-400/70"
                                key={action}
                                onClick={() => handleInventoryAction(item, action)}
                                type="button"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeNpc && companionSheet && isCompanionExpanded ? (
              <div className="hidden mt-3 space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
                <button
                  className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-left transition hover:border-ember-400/60"
                  onClick={() =>
                    setIsCompanionExpanded((isExpanded) => !isExpanded)
                  }
                  type="button"
                >
                  <div className="grid size-12 shrink-0 place-items-end overflow-hidden rounded-md border border-white/10 bg-black/35">
                    <Image
                      alt={`${activeNpc.name} Begleiterbild`}
                      className="max-h-12 object-contain drop-shadow-xl"
                      height={72}
                      src={activeNpc.modelImageUrl}
                      width={56}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                      NPC-Begleitung
                    </p>
                    <p className="truncate text-sm font-bold">{activeNpc.name}</p>
                    <p className="line-clamp-2 text-xs text-slate-400">
                      Level {activeNpc.level} {activeNpc.className} ·{" "}
                      {activeNpc.subclassName}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-1 text-center text-[0.65rem] font-bold text-slate-100">
                    <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-1">
                      <span className="block text-[0.55rem] font-semibold text-slate-400">HP</span>
                      {companionRuntimeStats?.currentHp}/{companionRuntimeStats?.maxHp}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-1">
                      <span className="block text-[0.55rem] font-semibold text-slate-400">AC</span>
                      {companionRuntimeStats?.ac}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-1">
                      <span className="block text-[0.55rem] font-semibold text-slate-400">SPD</span>
                      {activeNpc.stats.speed}
                    </span>
                  </div>
                  <div className="shrink-0 text-slate-300">
                    {isCompanionExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </div>
                </button>

                {isCompanionExpanded ? (
                  <>
                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] overflow-hidden rounded-md border border-white/10 bg-black/35">
                      <div className="flex h-24 items-end justify-center bg-gradient-to-b from-white/5 to-transparent">
                        <Image
                          alt={`${activeNpc.name} Begleiterbild`}
                          className="max-h-24 object-contain drop-shadow-2xl"
                          height={180}
                          src={activeNpc.modelImageUrl}
                          width={140}
                        />
                      </div>
                      <div className="border-l border-white/10 p-2">
                        <p className="text-sm font-bold">{activeNpc.name}</p>
                        <p className="text-xs text-slate-400">
                          Level {activeNpc.level} {activeNpc.className} ·{" "}
                          {activeNpc.subclassName}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                          <HeartPulse className="mb-1 size-4 text-ember-400" />
                          <p className="text-xs text-slate-400">HP</p>
                          <p className="whitespace-nowrap text-sm font-bold">
                            {companionRuntimeStats?.currentHp}/{companionRuntimeStats?.maxHp}
                          </p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                          <ShieldCheck className="mb-1 size-4 text-ember-400" />
                          <p className="text-xs text-slate-400">AC</p>
                          <p className="whitespace-nowrap text-sm font-bold">
                            {companionRuntimeStats?.ac}
                          </p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                          <Swords className="mb-1 size-4 text-ember-400" />
                          <p className="text-xs text-slate-400">Speed</p>
                          <p className="whitespace-nowrap text-sm font-bold">
                            {activeNpc.stats.speed} ft.
                          </p>
                        </div>
                    </div>

                    <button
                      className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-left transition hover:border-ember-400"
                      onClick={() =>
                        rollFormula(
                          `${activeNpc.name} Initiative`,
                          `1d20+${activeNpc.stats.initiative}`,
                          { initiativeCharacterId: activeNpc.id },
                        )
                      }
                      type="button"
                    >
                      <span className="block text-xs text-slate-400">
                        Initiative würfeln
                      </span>
                      <span className="text-sm font-bold">
                        +{activeNpc.stats.initiative}
                      </span>
                    </button>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                        Aktionen
                      </p>
                      <div className="space-y-2">
                        {companionSheet.actions.map((action) => (
                          <div
                            className="rounded-md border border-white/10 bg-white/[0.05] p-2"
                            key={action.name}
                          >
                            <p className="text-sm font-bold">{action.name}</p>
                            <p className="text-xs text-slate-500">
                              {action.note}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-xs transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(
                                    `${activeNpc.name} ${action.name} Angriff`,
                                    `1d20+${action.attack}`,
                                  )
                                }
                                type="button"
                              >
                                Angriff +{action.attack}
                              </button>
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-xs transition hover:border-ember-400/70"
                                onClick={() =>
                                  rollFormula(
                                    `${activeNpc.name} ${action.name} Schaden`,
                                    action.damage,
                                  )
                                }
                                type="button"
                              >
                                Schaden {action.damage}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              aria-label="Würfelsystem öffnen"
              className="hidden"
              onClick={() => setIsDicePanelOpen((isOpen) => !isOpen)}
              title="Würfel"
              type="button"
            >
              <Dice5 className="size-5" />
            </button>
            {false ? (
              <div className="absolute left-0 top-16 w-72 rounded-md border border-white/10 bg-ink-950/95 p-3 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-100">
                    Würfel
                  </p>
                  <button
                    aria-label="Würfelfenster schließen"
                    className="grid size-7 place-items-center rounded-md border border-white/10 bg-white/10"
                    onClick={() => setIsDicePanelOpen(false)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {diceTypes.map((item) => (
                    <button
                      className={`rounded-md border px-2 py-2 text-xs font-bold transition ${
                        diceType === item
                          ? "border-ember-400 bg-ember-500 text-ink-950"
                          : "border-white/10 bg-white/[0.06] text-slate-100 hover:border-ember-400/70"
                      }`}
                      key={item}
                      onClick={() => setDiceType(item)}
                      type="button"
                    >
                      d{item}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["normal", "advantage", "disadvantage"] as RollMode[]).map(
                    (mode) => (
                      <button
                        className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                          rollMode === mode
                            ? "border-ember-400 bg-ember-500 text-ink-950"
                            : "border-white/10 bg-white/[0.06] text-slate-100 hover:border-ember-400/70"
                        }`}
                        disabled={diceType !== 20 && mode !== "normal"}
                        key={mode}
                        onClick={() => setRollMode(mode)}
                        type="button"
                      >
                        {mode === "normal"
                          ? "Normal"
                          : mode === "advantage"
                            ? "Vorteil"
                            : "Nachteil"}
                      </button>
                    ),
                  )}
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-slate-400">
                    Modifikator
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-100 outline-none"
                    onChange={(event) =>
                      setRollModifier(Number(event.target.value) || 0)
                    }
                    type="number"
                    value={rollModifier}
                  />
                </label>

                <button
                  className="mt-3 h-10 w-full rounded-md border border-ember-400/50 bg-ember-500 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
                  onClick={rollManualDice}
                  type="button"
                >
                  Würfeln
                </button>

                {rollResult ? (
                  <div className="mt-3 rounded-md border border-white/10 bg-black/35 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                      Ergebnis
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {rollResult?.total}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      d{rollResult?.diceType}: {rollResult?.rolls.join(" / ")}
                      {" + "}
                      Mod {rollResult?.modifier}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
              <BookOpen className="mb-1 size-4 text-ember-400" />
              <p className="text-xs text-slate-400">Aktuelle Szene</p>
              <p className="text-sm font-semibold">
                {currentScene.chapter} · {currentScene.title}
              </p>
            </div>

        <section className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/70 shadow-2xl">
          <div
            className="relative flex w-full min-h-[26rem] flex-1 items-end bg-cover bg-center p-4 lg:min-h-0 lg:p-5"
            style={{
              backgroundImage: `linear-gradient(180deg,rgba(17,24,39,0.22),rgba(3,4,10,0.94)),url('${currentScene.imageUrl}')`,
            }}
          >
            {false && isCombatScene && combatRoundState.round > 0 ? (
              <div className="absolute left-3 right-3 top-14 z-20 grid gap-2 rounded-md border border-white/10 bg-ink-950/80 p-2 shadow-2xl backdrop-blur lg:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="rounded-md border border-ember-400/35 bg-ember-500/10 px-3 py-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ember-300">
                    Kampfrunde {combatRoundState.round}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-100">
                    {activeCombatActor?.name !== undefined
                      ? `${activeCombatActor?.name} ist am Zug`
                      : "Zug wird vorbereitet"}
                  </p>
                  <p className="mt-1 text-[0.7rem] font-semibold text-slate-300">
                    Zug {combatRoundState.turnIndex + 1}/
                    {visibleInitiativeOrder.length}
                  </p>
                  {combatRoundState.turnControl ? (
                    <p className="mt-1 text-[0.68rem] font-semibold text-slate-400">
                      {combatRoundState.turnControl?.requiresPlayerAction
                        ? "Hero-Turn: Angriff bereit"
                        : combatRoundState.turnControl?.autoResolvable
                          ? "Enemy-Turn: Backend auto-resolve"
                          : "Turn wird vom Backend geprueft"}
                    </p>
                  ) : null}
                  <button
                    className="mt-2 w-full rounded-md border border-ember-400/45 bg-ember-500/15 px-3 py-2 text-xs font-black text-ember-100 transition hover:border-ember-300 hover:bg-ember-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBackendTurnResolving}
                    onClick={() => resolveBackendCombatTurn()}
                    type="button"
                  >
                    {isBackendTurnResolving
                      ? "Backend rechnet..."
                      : combatRoundState.turnControl?.autoResolvable
                        ? "Enemy-Turn aufloesen"
                        : "Aktion abschliessen"}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {combatRoundState.enemies.map((enemy) => (
                    <div
                      className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2"
                      key={enemy.id}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-black text-red-100">
                          {enemy.name}
                        </p>
                        <span className="rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-[0.62rem] font-bold text-slate-200">
                          AC {enemy.ac}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/45">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, (enemy.currentHp / enemy.maxHp) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[0.7rem] font-semibold text-slate-300">
                        HP {enemy.currentHp}/{enemy.maxHp} · Speed {enemy.speed} ft.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {isDmPanelOpen ? (
              <aside className="absolute right-3 top-3 z-20 flex max-h-[28rem] w-[min(22rem,calc(100%-1.5rem))] flex-col rounded-md border border-ember-400/30 bg-ink-950/95 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ember-300">
                      Out of Character
                    </p>
                    <h2 className="text-sm font-bold">DM-Chat</h2>
                  </div>
                  <button
                    aria-label="DM-Chat schließen"
                    className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/10"
                    onClick={() => setIsDmPanelOpen(false)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {dmMessages.map((message) => (
                    <div
                      className={`rounded-md border p-2 text-sm leading-relaxed ${
                        message.sender === "DM"
                          ? "border-ember-400/30 bg-ember-500/10"
                          : "border-white/10 bg-white/[0.06]"
                      }`}
                      key={message.id}
                    >
                      <p className="mb-1 text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                        {message.sender}
                      </p>
                      <p>{message.text}</p>
                      {message.sender === "DM" && message.command ? (
                        <div className="mt-2 flex flex-wrap gap-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                          <span className="rounded border border-white/10 bg-black/20 px-1.5 py-1">
                            {message.command}
                          </span>
                          {message.stateLocked ? (
                            <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-1 text-emerald-200">
                              State locked
                            </span>
                          ) : null}
                          {message.topics?.slice(0, 3).map((topic) => (
                            <span
                              className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-1"
                              key={topic}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {message.sender === "DM" &&
                      message.allowedScope &&
                      message.allowedScope.length > 0 ? (
                        <p className="mt-1 text-[0.62rem] text-slate-500">
                          Scope: {message.allowedScope.slice(0, 4).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 p-3">
                  <div className="mb-2 grid grid-cols-4 gap-1">
                    {(["/help", "/lore", "/rules", "/recap"] as const).map(
                      (command) => (
                        <button
                          className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[0.65rem] font-bold text-slate-200 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                          key={command}
                          onClick={() => void sendDmHelpMessage(command)}
                          type="button"
                        >
                          {command}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="flex gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    onChange={(event) => setDmInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        sendDmMessage();
                      }
                    }}
                    placeholder="Frage an den DM..."
                    value={dmInput}
                  />
                  <button
                    aria-label="DM-Nachricht senden"
                    className="grid size-10 place-items-center rounded-md border border-ember-400/50 bg-ember-500 text-ink-950 transition hover:bg-ember-400"
                    onClick={sendDmMessage}
                    type="button"
                  >
                    <Send className="size-4" />
                  </button>
                  </div>
                </div>
              </aside>
            ) : null}

            {!isCombatScene && pendingCheck ? (
              <div className="absolute left-1/2 top-4 z-30 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-ember-400/60 bg-ink-950/95 p-3 text-center shadow-glow">
                <p className="text-xs uppercase tracking-[0.18em] text-ember-300">
                  Skillcheck erforderlich
                </p>
                <p className="mt-1 text-sm font-bold text-slate-100">
                  Bitte würfle {formatChecks(pendingCheck.checks)} im
                  Charakterbogen.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Die passenden Skills sind links markiert. Der DM wartet auf
                  dein Ergebnis.
                </p>
              </div>
            ) : null}

            {isInitiativeScene ? (
              <div className="absolute left-1/2 top-4 z-30 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-ember-400/60 bg-ink-950/95 p-3 text-center shadow-glow">
                <p className="text-xs uppercase tracking-[0.18em] text-ember-300">
                  Initiative erforderlich
                </p>
                <p className="mt-1 text-sm font-bold text-slate-100">
                  {initiativeStatus}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Würfle links im Hauptbogen und im NPC-Bogen jeweils die
                  Initiative.
                </p>
              </div>
            ) : null}

            {isCharacterSelection ? (
              <div className="grid h-full w-full items-stretch gap-4 lg:grid-cols-2">
                {(["ryu", "ayane"] as CharacterId[]).map((characterId) => {
                  const character = characters[characterId];

                  return (
                    <button
                      className="group flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-ink-950/75 text-left transition hover:border-ember-400/70 hover:bg-ink-950/90"
                      key={character.id}
                      onClick={() => selectCharacter(character.id)}
                      type="button"
                    >
                      <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-b from-white/5 to-transparent px-3 py-5">
                        <Image
                          alt={`${character.name} Charaktermodell`}
                          className="h-auto max-h-[min(21rem,42dvh)] w-auto object-contain object-center drop-shadow-2xl transition group-hover:scale-[1.03]"
                          height={420}
                          src={character.modelImageUrl}
                          width={320}
                        />
                      </div>
                      <div className="border-t border-white/10 bg-black/50 p-4">
                        <span className="block text-xl font-semibold">
                          {character.name}
                        </span>
                        <span className="mt-1 block text-sm text-ember-300">
                          Level {character.level} {character.className} |{" "}
                          {character.subclassName}
                        </span>
                        <span className="mt-1 block text-sm text-slate-300">
                          HP {character.stats.hp} | AC {character.stats.ac} |
                          Initiative +{character.stats.initiative} | Speed{" "}
                          {character.stats.speed} ft.
                        </span>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300">
                          {character.backstory}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="relative w-full max-w-5xl rounded-md bg-black/15 pb-16 pr-16">
                <div className="min-w-0">
                  <p className="mb-2 inline-flex rounded-sm bg-ember-500 px-2 py-1 text-xs font-bold text-ink-950">
                    {currentDialogueLine.speaker}
                  </p>
                  <p className="min-h-24 text-balance text-2xl font-semibold leading-snug transition-opacity duration-200">
                    {dialogueWords.map((word, index) => (
                      <span
                        className={`inline-block transition-all duration-300 ${
                          index < visibleWordCount
                            ? "translate-y-0 opacity-100"
                            : "translate-y-1 opacity-0"
                        }`}
                        key={`${word}-${index}`}
                      >
                        {word}
                        {index < dialogueWords.length - 1 ? "\u00a0" : ""}
                      </span>
                    ))}
                  </p>
                  {activeCharacter && activeNpc && !isCharacterSelection ? (
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      Hauptcharakter: {activeCharacter.name}. Begleitung:{" "}
                      {activeNpc.name}.
                    </p>
                  ) : null}
                </div>
                {!isLastDialogueLine || !isDialogueFullyVisible ? (
                  <button
                    aria-label="Dialog fortsetzen"
                    className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full border border-ember-400/60 bg-ember-500 text-ink-950 shadow-glow transition hover:scale-105 hover:bg-ember-400"
                    onClick={continueDialogue}
                    title="Dialog fortsetzen"
                    type="button"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {!isCharacterSelection ? (
            <div className="hidden min-h-20 space-y-2 overflow-y-auto border-t border-white/10 bg-ink-950/95 p-2">
              {!isCombatScene && pendingCheck ? (
                <div className="rounded-md border border-ember-400/40 bg-ember-500/10 px-3 py-2 text-sm">
                  <p className="font-bold text-ember-200">
                    DM wartet auf Wurf
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Bitte würfle {formatChecks(pendingCheck.checks)} im
                    Charakterbogen. Danach entscheidet der DC, ob die Szene
                    gelingt oder scheitert.
                  </p>
                </div>
              ) : null}
              {!isCombatScene && isLastDialogueLine && isDialogueFullyVisible
                ? currentScene.choices.map((choice) => renderChoiceButton(choice))
                : null}
            </div>
          ) : null}
        </section>
          </div>
          <aside className="flex min-h-0 flex-col gap-3 rounded-md border border-white/10 bg-ink-950/70 p-3">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <p className="text-xs uppercase tracking-[0.18em] text-ember-300">
                Spieleraktionen
              </p>
              {isCombatScene && visibleInitiativeOrder.length > 0 ? (
                <div className="space-y-2 rounded-md border border-white/10 bg-white/[0.04] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ember-300">
                      Initiative
                    </p>
                    {combatRoundState.round > 0 ? (
                      <span className="rounded border border-ember-400/35 bg-ember-500/10 px-2 py-1 text-[0.62rem] font-black text-ember-100">
                        Runde {combatRoundState.round}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-1">
                    {visibleInitiativeOrder.map((actor, index) => (
                      <div
                        className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5 text-[0.68rem] font-bold ${
                          actor.id === combatRoundState.activeActorId
                            ? "border-ember-400 bg-ember-500 text-ink-950 shadow-glow"
                            : actor.kind === "enemy"
                              ? "border-red-400/40 bg-red-500/10 text-red-100"
                              : "border-white/10 bg-white/[0.06] text-slate-100"
                        }`}
                        key={actor.id}
                      >
                        <span className="grid size-5 place-items-center rounded border border-current/25 text-[0.62rem]">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{actor.name}</span>
                          <span className="block text-[0.55rem] font-black uppercase tracking-[0.1em] opacity-70">
                            {actor.id === combatRoundState.activeActorId
                              ? "Am Zug"
                              : actor.kind === "enemy"
                                ? "Gegner"
                                : actor.kind === "companion"
                                  ? "Begleiter"
                                  : "Held"}
                          </span>
                        </span>
                        <span className="rounded border border-current/20 px-1.5 py-0.5 text-[0.62rem] font-black">
                          {actor.total !== undefined ? actor.total : "DM"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {combatRoundState.round > 0 ? (
                    <div className="rounded-md border border-ember-400/30 bg-ink-950/80 p-2 shadow-[0_0_20px_rgba(251,146,60,0.12)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-100">
                            {activeCombatActor
                              ? `${activeCombatActor.name} ist am Zug`
                              : "Zug wird vorbereitet"}
                          </p>
                          <p className="mt-1 text-[0.7rem] font-semibold text-slate-300">
                            Zug {combatRoundState.turnIndex + 1}/
                            {visibleInitiativeOrder.length}
                          </p>
                        </div>
                        <span className="shrink-0 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-[0.62rem] font-black text-slate-200">
                          5e Flow
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[0.58rem] font-black uppercase tracking-[0.08em]">
                        <span
                          className={`rounded border px-1 py-1 ${
                            combatAttackFlowState.step === "chooseAction"
                              ? "border-ember-400 bg-ember-500 text-ink-950"
                              : "border-white/10 bg-white/[0.04] text-slate-400"
                          }`}
                        >
                          1 Aktion
                        </span>
                        <span
                          className={`rounded border px-1 py-1 ${
                            combatAttackFlowState.step === "chooseTarget"
                              ? "border-ember-400 bg-ember-500 text-ink-950"
                              : "border-white/10 bg-white/[0.04] text-slate-400"
                          }`}
                        >
                          2 Ziel
                        </span>
                        <span
                          className={`rounded border px-1 py-1 ${
                            combatAttackFlowState.step === "awaitAttackRoll" ||
                            combatAttackFlowState.step === "awaitDamageRoll"
                              ? "border-emerald-400 bg-emerald-500 text-ink-950"
                              : combatAttackFlowState.step === "turnResolved"
                                ? "border-white/20 bg-white/[0.08] text-slate-200"
                                : "border-white/10 bg-white/[0.04] text-slate-400"
                          }`}
                        >
                          3 Roll
                        </span>
                      </div>
                      <p className="mt-2 rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[0.68rem] font-semibold text-slate-300">
                        {combatFlowStepCopy[combatAttackFlowState.step]}
                      </p>
                      {combatRoundState.turnControl?.requiresPlayerAction &&
                      combatAttackFlowState.step === "chooseAction" ? (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-2">
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ember-300">
                            1. Aktion waehlen
                          </p>
                          <div className="mt-1 grid gap-1.5">
                            {activeCombatActions.map((action) => (
                              <button
                                className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-2 text-left transition hover:border-ember-400/70 hover:bg-ember-500/10"
                                key={action.name}
                                onClick={() => {
                                  setSelectedCombatTargetId(null);
                                  setCombatAttackFlowState({
                                    actorId: activeCombatActor?.id ?? null,
                                    actionName: action.name,
                                    attackFormula: `1d20+${action.attack}`,
                                    damageFormula: action.damage,
                                    targetId: null,
                                    attackTotal: null,
                                    attackHit: null,
                                    step: "chooseTarget",
                                  });
                                }}
                                type="button"
                              >
                                <span className="block text-sm font-black text-slate-100">
                                  {action.name}
                                </span>
                                <span className="mt-1 block text-[0.68rem] font-semibold text-slate-300">
                                  Hit +{action.attack} | Schaden {action.damage}
                                </span>
                                <span className="mt-1 block text-[0.62rem] text-slate-500">
                                  {action.note}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {combatRoundState.turnControl?.requiresPlayerAction &&
                      (combatAttackFlowState.step === "chooseTarget" ||
                        combatAttackFlowState.step === "awaitAttackRoll") ? (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-2">
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ember-300">
                            2. Ziel waehlen
                          </p>
                          {combatAttackFlowState.actionName ? (
                            <p className="mt-1 text-[0.68rem] font-semibold text-slate-300">
                              Aktion: {combatAttackFlowState.actionName}
                            </p>
                          ) : null}
                          <div className="mt-1 grid gap-1.5">
                            {availableCombatTargets.map((target) => (
                              <button
                                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs font-semibold transition ${
                                  selectedCombatTargetId === target.id
                                    ? "border-ember-400 bg-ember-500/20 text-ember-100"
                                    : "border-white/10 bg-white/[0.05] text-slate-100 hover:border-ember-400/60"
                                }`}
                                key={target.id}
                                onClick={() => {
                                  setSelectedCombatTargetId(target.id);
                                  setCombatAttackFlowState({
                                    actorId: activeCombatActor?.id ?? null,
                                    actionName: combatAttackFlowState.actionName,
                                    attackFormula:
                                      combatAttackFlowState.attackFormula,
                                    damageFormula:
                                      combatAttackFlowState.damageFormula,
                                    targetId: target.id,
                                    attackTotal: null,
                                    attackHit: null,
                                    step: "awaitAttackRoll",
                                  });
                                }}
                                type="button"
                              >
                                <span className="min-w-0 truncate">
                                  {target.name}
                                </span>
                                <span className="shrink-0 text-[0.62rem] text-slate-300">
                                  AC {target.ac ?? "?"} | HP{" "}
                                  {target.currentHp ?? "?"}/{target.maxHp ?? "?"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <button
                        className="mt-2 w-full rounded-md border border-ember-400/55 bg-ember-500 px-3 py-2 text-xs font-black text-ink-950 shadow-glow transition hover:border-ember-200 hover:bg-ember-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
                        disabled={
                          isBackendTurnResolving ||
                          (combatRoundState.turnControl?.requiresPlayerAction &&
                            ((combatAttackFlowState.step === "awaitAttackRoll" &&
                              (!selectedCombatTarget ||
                                !combatAttackFlowState.actionName)) ||
                              (combatAttackFlowState.step === "awaitDamageRoll" &&
                                !canResolveBackendDamageRoll) ||
                              (combatAttackFlowState.step !== "awaitAttackRoll" &&
                                combatAttackFlowState.step !== "awaitDamageRoll" &&
                                combatAttackFlowState.step !== "turnResolved")))
                        }
                        onClick={() => {
                          if (
                            activeCombatActor?.kind === "enemy" &&
                            combatAttackFlowState.step === "enemyResolving"
                          ) {
                            void resolveBackendCombatTurn();
                            return;
                          }

                          if (
                            activeCombatActor?.kind === "enemy" &&
                            combatAttackFlowState.step === "turnResolved"
                          ) {
                            endPlayerCombatTurn();
                            return;
                          }

                          if (combatRoundState.turnControl?.autoResolvable) {
                            void resolveBackendCombatTurn();
                            return;
                          }

                          if (combatAttackFlowState.step === "awaitAttackRoll") {
                            void rollCombatAttack();
                            return;
                          }

                          if (combatAttackFlowState.step === "awaitDamageRoll") {
                            void rollCombatDamage();
                            return;
                          }

                          if (combatAttackFlowState.step === "turnResolved") {
                            endPlayerCombatTurn();
                          }
                        }}
                        type="button"
                      >
                        {isBackendTurnResolving
                          ? "Attack Roll wird ausgewertet..."
                          : activeCombatActor?.kind === "enemy" &&
                              combatAttackFlowState.step === "turnResolved"
                            ? "Weiter zum naechsten Zug"
                          : activeCombatActor?.kind === "enemy" ||
                              combatRoundState.turnControl?.autoResolvable
                            ? "DM-Gegnerzug auswerten"
                            : combatAttackFlowState.step === "chooseAction"
                              ? "Erst Aktion waehlen"
                              : combatAttackFlowState.step === "chooseTarget"
                                ? "Dann Ziel waehlen"
                                : combatAttackFlowState.step === "awaitDamageRoll"
                                  ? requiresBackendDamageRoll
                                    ? "4. Backend-Damage-Roll ausloesen"
                                    : "Kein Damage Roll offen"
                                  : combatAttackFlowState.step === "turnResolved"
                                    ? "Zug beenden"
                                : selectedCombatTarget &&
                                    combatAttackFlowState.actionName
                                  ? `3. Angriff wuerfeln (${combatAttackFlowState.attackFormula})`
                                  : "Combat-Schritt offen"}
                      </button>
                      {combatAttackFlowState.attackTotal !== null ? (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-slate-200">
                          <p className="font-black text-slate-100">
                            Angriffswurf: {combatAttackFlowState.attackTotal}
                          </p>
                          <p className="mt-1 font-semibold">
                            {requiresBackendDamageRoll
                              ? "Backend fordert jetzt den Damage Roll an."
                              : "Kein Damage Roll offen, Zug kann beendet werden."}
                          </p>
                        </div>
                      ) : null}
                      {activeCombatActor?.kind === "enemy" &&
                      combatAttackFlowState.step === "turnResolved" ? (
                        <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 px-2 py-2 text-xs text-red-50">
                          <p className="font-black text-red-100">
                            DM-KI: {activeCombatActor.name} greift{" "}
                            {getCombatActorName(combatAttackFlowState.targetId)} an
                          </p>
                          <p className="mt-1 text-slate-300">
                            Angriffswurf verdeckt.{" "}
                            {combatAttackFlowState.attackHit
                              ? "Treffer."
                              : "Verfehlt."}
                          </p>
                          {combatAttackFlowState.attackHit ? (
                            <p className="mt-1 font-semibold text-red-100">
                              Sichtbarer Gesamtschaden:{" "}
                              {combatAttackFlowState.damageTotal ?? 0} | HP jetzt{" "}
                              {combatAttackFlowState.remainingHp ?? "?"}
                            </p>
                          ) : (
                            <p className="mt-1 font-semibold text-slate-300">
                              Kein Schaden.
                            </p>
                          )}
                        </div>
                      ) : null}
                      {isLastResolutionEnemyAction && lastCombatResolution ? (
                        <div className="mt-2 rounded-md border border-red-400/35 bg-red-500/10 px-2 py-2 text-xs text-red-50">
                          <p className="font-black text-red-100">
                            DM-KI: {getCombatActorName(lastCombatResolution.actorId)} greift{" "}
                            {getCombatActorName(lastCombatResolution.targetId)} an
                          </p>
                          <p className="mt-1 text-slate-300">
                            Angriffswurf verdeckt.{" "}
                            {lastCombatResolution.attack?.hit
                              ? "Treffer."
                              : "Verfehlt."}
                          </p>
                          {lastCombatResolution.attack?.hit ? (
                            <p className="mt-1 font-semibold text-red-100">
                              Sichtbarer Gesamtschaden:{" "}
                              {lastCombatResolution.damage?.total ?? 0} | Helden-HP jetzt{" "}
                              {lastCombatResolution.hp?.remainingHp ?? "?"}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {isLastResolutionHeroAction && lastCombatResolution ? (
                        <div className="mt-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-50">
                          <p className="font-black text-emerald-100">
                            {getCombatActorName(lastCombatResolution.actorId)} greift{" "}
                            {getCombatActorName(lastCombatResolution.targetId)} an
                          </p>
                          <p className="mt-1 text-slate-300">
                            2. Attack Roll:{" "}
                            {lastCombatResolution.attack?.total ?? "?"} gegen AC{" "}
                            {lastCombatResolution.attack?.targetAc ?? "?"} -{" "}
                            {lastCombatResolution.attack?.hit
                              ? "Treffer"
                              : "Verfehlt"}
                          </p>
                          {lastCombatResolution.attack?.hit ? (
                            <p className="mt-1 font-semibold text-emerald-100">
                              3. Damage Roll:{" "}
                              {lastCombatResolution.damage?.total ?? 0} Schaden
                              {" | "}
                              Ziel-HP jetzt{" "}
                              {lastCombatResolution.hp?.remainingHp ?? "?"}
                            </p>
                          ) : (
                            <p className="mt-1 font-semibold text-slate-300">
                              Kein Damage Roll bei Miss.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {combatRoundState.round > 0 ? (
                    <div className="grid gap-1.5">
                      {combatRoundState.enemies.map((enemy) => (
                        <div
                          className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-2"
                          key={enemy.id}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-black text-red-100">
                              {enemy.name}
                            </p>
                            <span className="rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-[0.62rem] font-bold text-slate-200">
                              AC {enemy.ac}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/45">
                            <div
                              className="h-full rounded-full bg-red-400"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (enemy.currentHp / enemy.maxHp) * 100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1 text-[0.68rem] font-semibold text-slate-300">
                            HP {enemy.currentHp}/{enemy.maxHp} | Speed{" "}
                            {enemy.speed} ft.
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isCharacterSelection ? (
                <div className="rounded-md border border-white/10 bg-white/[0.05] p-3 text-sm leading-relaxed text-slate-300">
                  Wähle links im Storybild Ryu oder Ayane als Hauptcharakter.
                  Danach erscheinen hier die auswählbaren Aktionen.
                </div>
              ) : null}
              {!isCombatScene && pendingCheck ? (
                <div className="rounded-md border border-ember-400/40 bg-ember-500/10 px-3 py-2 text-sm">
                  <p className="font-bold text-ember-200">
                    DM wartet auf Wurf
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Bitte würfle {formatChecks(pendingCheck.checks)} im
                    Charakterbogen. Danach entscheidet der DC, ob die Szene
                    gelingt oder scheitert.
                  </p>
                </div>
              ) : null}
              {!isCombatScene &&
              !isCharacterSelection &&
              isLastDialogueLine &&
              isDialogueFullyVisible
                ? currentScene.choices.map((choice) => renderChoiceButton(choice))
                : null}
            </div>

            <div className="flex justify-center border-t border-white/10 pt-3 text-slate-50">
              <button
                aria-label="Letztes Wuerfelergebnis"
                className="relative mx-auto grid size-16 place-items-center"
                type="button"
              >
                <span
                  className={`d20-result ${
                    rollResult ? "d20-result-roll" : ""
                  } grid size-16 place-items-center border bg-gradient-to-br text-xl font-black shadow-glow ${diceColorClass[diceColor]}`}
                  key={rollAnimationKey}
                >
                  <svg
                    aria-hidden="true"
                    className="d20-result-shape"
                    viewBox="0 0 100 100"
                  >
                    <polygon className="d20-outline" points="50,3 82,18 96,48 88,70 50,97 12,70 4,48 18,18" />
                    <polygon className="d20-facet d20-facet-light" points="50,3 18,18 50,36 82,18" />
                    <polygon className="d20-facet d20-facet-mid" points="18,18 4,48 50,36" />
                    <polygon className="d20-facet d20-facet-dark" points="82,18 96,48 50,36" />
                    <polygon className="d20-facet d20-facet-front" points="4,48 50,36 96,48 50,66" />
                    <polygon className="d20-facet d20-facet-mid" points="4,48 12,70 50,66" />
                    <polygon className="d20-facet d20-facet-dark" points="96,48 88,70 50,66" />
                    <polygon className="d20-facet d20-facet-bottom" points="12,70 50,97 50,66" />
                    <polygon className="d20-facet d20-facet-bottom-dark" points="88,70 50,97 50,66" />
                    <polyline className="d20-edge" points="50,3 50,36 4,48 50,66 50,97" />
                    <polyline className="d20-edge" points="18,18 50,36 82,18" />
                    <polyline className="d20-edge" points="96,48 50,66 12,70" />
                  </svg>
                  <span className="d20-result-number">
                    {rollResult?.total ?? "d20"}
                  </span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      </section>
      <aside
        className="hidden"
      >
        <button
          aria-label="Letztes Wuerfelergebnis"
          className="relative mx-auto grid size-16 place-items-center"
          type="button"
        >
          <span
            className={`d20-result ${
              rollResult ? "d20-result-roll" : ""
            } grid size-16 place-items-center border bg-gradient-to-br text-xl font-black shadow-glow ${diceColorClass[diceColor]}`}
            key={rollAnimationKey}
          >
            <svg
              aria-hidden="true"
              className="d20-result-shape"
              viewBox="0 0 100 100"
            >
              <polygon className="d20-outline" points="50,3 82,18 96,48 88,70 50,97 12,70 4,48 18,18" />
              <polygon className="d20-facet d20-facet-light" points="50,3 18,18 50,36 82,18" />
              <polygon className="d20-facet d20-facet-mid" points="18,18 4,48 50,36" />
              <polygon className="d20-facet d20-facet-dark" points="82,18 96,48 50,36" />
              <polygon className="d20-facet d20-facet-front" points="4,48 50,36 96,48 50,66" />
              <polygon className="d20-facet d20-facet-mid" points="4,48 12,70 50,66" />
              <polygon className="d20-facet d20-facet-dark" points="96,48 88,70 50,66" />
              <polygon className="d20-facet d20-facet-bottom" points="12,70 50,97 50,66" />
              <polygon className="d20-facet d20-facet-bottom-dark" points="88,70 50,97 50,66" />
              <polyline className="d20-edge" points="50,3 50,36 4,48 50,66 50,97" />
              <polyline className="d20-edge" points="18,18 50,36 82,18" />
              <polyline className="d20-edge" points="96,48 50,66 12,70" />
            </svg>
            <span className="d20-result-number">{rollResult?.total ?? "d20"}</span>
          </span>
        </button>
      </aside>
    </main>
  );
}
