"use client";

import {
  BookOpen, Bot, ChevronDown, ChevronRight, ClipboardList, Hourglass,
  Dice5, Drama, Eye, Feather, Flame, FlaskConical, HandMetal,
  HeartPulse, Leaf, LogIn, MessageSquare, Music, Palette, Scan, ScrollText,
  Search, Send, ShieldCheck, Skull, Snowflake, Sparkles,
  Star, Sword, Swords, Telescope, Trees, UserPlus, Waves,
  Wind, Wrench, X, Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const D20Component = dynamic(() => import("@/components/D20"), { ssr: false });
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
import {
  type CombatAttackFlowState,
  type CombatRoundState,
  type EnemyCombatState,
  type InitiativeActor,
  type LegacySaveEncounterResolveResponse,
  advanceCombatTurnState,
  combatFlowStepCopy,
  createCombatAttackFlowStateForActor,
  createInitialCombatAttackFlowState,
  createInitialCombatEnemies,
  createInitialCombatRoundState,
  getCombatActorDisplayName,
  writeCombatRouteStateSnapshot,
} from "@/lib/combatState";

const SAVE_KEY = "falkenwacht.saveStates";
const LAST_SAVE_KEY = "falkenwacht.lastSave";
const MAX_ACCOUNT_SAVES = 15;
const MAX_CAMPAIGN_SAVES = 5;
const CAMPAIGN_TITLE = "Falkenwacht - Die Korruption der Greifenstadt";
const WORD_REVEAL_MS = 35;
const diceTypes = [4, 6, 8, 10, 12, 20, 100] as const;
const BACKEND_SLOT_NAME = "autosave";
const BACKEND_COMBAT_SCENE_NUMBER = 3;
const BACKEND_MAX_SCENE_NUMBER = 3;

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

const getBackendSceneNumber = (sceneId: string) => {
  if (sceneId.startsWith("kampf-") || sceneId === "hinterhalt-handelsroute") {
    return BACKEND_COMBAT_SCENE_NUMBER;
  }

  const frontendSceneNumber =
    scenes.findIndex((scene) => scene.id === sceneId) + 1;

  if (
    frontendSceneNumber >= 1 &&
    frontendSceneNumber <= BACKEND_MAX_SCENE_NUMBER
  ) {
    return frontendSceneNumber;
  }

  return 1;
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
      ["GEW", "+7"],
      ["INT", "+5"],
      ["STÄ", "+1"],
      ["WEI", "+2"],
    ],
    skills: [
      ["Akrobatik", "+7"],
      ["Überzeugen", "+2"],
      ["Heimlichkeit", "+9"],
      ["Einschüchtern", "+1"],
      ["Fingerfertigkeit", "+8"],
      ["Überleben", "+3"],
      ["Athletik", "+4"],
      ["Motivation", "+2"],
      ["Wahrnehmung", "+5"],
      ["Arkane Kunde", "+0"],
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
  const [saveRestored, setSaveRestored] = useState(false);
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
  const [d20TriggerKey, setD20TriggerKey] = useState(0);
  const [diceColor, setDiceColor] = useState<DiceColor>("arcane");
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
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
    arcane: "from-[#080e30] to-[#0a0a20] text-white border-[#d4af37]/60",
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

    setSaveRestored(true);
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
  const getCombatActorName = (actorId?: string | null) =>
    getCombatActorDisplayName(actorId, visibleInitiativeOrder, (combatActorId) => {
      const frontendCharacterId = toFrontendCharacterId(combatActorId);

      return frontendCharacterId
        ? characters[frontendCharacterId].name
        : null;
    });
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
  const lastCombatAttack = lastCombatResolution?.attack ?? null;
  const lastCombatDamage = lastCombatResolution?.damage ?? null;
  const lastCombatHp = lastCombatResolution?.hp ?? null;
  const lastCombatSummary =
    lastCombatResolution && lastCombatAttack
      ? {
          actorName: getCombatActorName(lastCombatResolution.actorId),
          targetName: getCombatActorName(lastCombatResolution.targetId),
          hit: lastCombatAttack.hit === true,
          total: lastCombatAttack.total ?? "?",
          targetAc: lastCombatAttack.targetAc ?? "?",
          critical: lastCombatAttack.critical === true,
          damage: lastCombatDamage?.total ?? 0,
          remainingHp: lastCombatHp?.remainingHp ?? null,
          isEnemyAction: isLastResolutionEnemyAction,
        }
      : null;
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
  const prepareCombatRouteHandoff = () => {
    writeCombatRouteStateSnapshot({
      roundState: combatRoundState,
      attackFlowState: combatAttackFlowState,
      selectedTargetId: selectedCombatTargetId,
      status: combatStatus,
      logEntries: gameLog.slice(0, 12),
    });
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
  const SKILL_ALIASES: Record<string, string[]> = {
    Acrobatics:        ['Akrobatik'],       Akrobatik:         ['Acrobatics'],
    Arcana:            ['Arkane Kunde'],    'Arkane Kunde':    ['Arcana'],
    Athletics:         ['Athletik'],        Athletik:          ['Athletics'],
    Deception:         ['Täuschen'],
    History:           ['Geschichte'],
    Insight:           ['Motivation'],      Motivation:        ['Insight'],
    Intimidation:      ['Einschüchtern'],   Einschüchtern:     ['Intimidation'],
    Investigation:     ['Nachforschung', 'Untersuchung'],
    Medicine:          ['Heilkunde'],
    Nature:            ['Naturkunde'],
    Perception:        ['Wahrnehmung'],     Wahrnehmung:       ['Perception'],
    Performance:       ['Auftreten'],
    Persuasion:        ['Überzeugen'],      Überzeugen:        ['Persuasion'],
    'Sleight of Hand': ['Fingerfertigkeit'],Fingerfertigkeit:  ['Sleight of Hand'],
    Stealth:           ['Heimlichkeit'],    Heimlichkeit:      ['Stealth'],
    Survival:          ['Überleben'],       Überleben:         ['Survival'],
    'Animal Handling': ['Tierumgang'],
  };
  const pendingSkillNames = new Set(
    (pendingCheck?.checks
      .map((check) => check.skill)
      .filter((skill): skill is string => Boolean(skill)) ?? [])
      .flatMap((name) => [name, ...(SKILL_ALIASES[name] ?? [])]),
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

  const buildFrontendStateFromLegacyEncounter = (
    response: LegacySaveEncounterResolveResponse,
  ): FrontendEncounterState | null => {
    const encounter = response.state.encounter;

    if (!encounter) {
      return null;
    }

    const participants = encounter.participants ?? [];
    const participantActors: FrontendEncounterActor[] = participants.map(
      (participant) => {
        const frontendCharacterId = toFrontendCharacterId(
          participant.participant_id,
        );
        const isEnemy = participant.side === "enemies";

        return {
          id: participant.participant_id,
          participantId: participant.participant_id,
          name: frontendCharacterId
            ? characters[frontendCharacterId].name
            : "Schattenräuber",
          kind: isEnemy ? "enemy" : "player",
          side: participant.side,
          currentHp: participant.current_hp,
          maxHp: participant.max_hp,
          ac: participant.armor_class ?? 10,
          speed: participant.speed ?? 30,
          defeated: participant.defeated,
        };
      },
    );
    const initiativeOrder = encounter.initiative_order.map((entry) => {
      const participant = participantActors.find(
        (actor) => actor.id === entry.participant_id,
      );

      return {
        id: entry.participant_id,
        participantId: entry.participant_id,
        name: participant?.name ?? entry.participant_id,
        kind: participant?.kind ?? "unknown",
        side: participant?.side,
        currentHp: participant?.currentHp,
        maxHp: participant?.maxHp,
        ac: participant?.ac,
        speed: participant?.speed,
        defeated: participant?.defeated,
        total: entry.total,
        roll: entry.roll,
        modifier: entry.modifier,
        nat20: entry.nat20,
        nat1: entry.nat1,
      };
    });
    const heroes = participantActors.filter((actor) => actor.side === "heroes");
    const enemies = participantActors.filter((actor) => actor.side === "enemies");
    const activeActor =
      participantActors.find(
        (actor) => actor.id === encounter.active_participant_id,
      ) ?? null;
    const activeActorIsHero = activeActor?.side === "heroes";
    const activeActorIsEnemy = activeActor?.side === "enemies";
    const attack = response.rules_result.attack as
      | {
          roll?: number;
          modifier?: number;
          total?: number;
          target_ac?: number;
          hit?: boolean;
          critical?: boolean;
          nat20?: boolean;
          nat1?: boolean;
        }
      | undefined;
    const damage = response.rules_result.damage as
      | {
          rolls?: number[];
          modifier?: number;
          total?: number;
          critical?: boolean;
        }
      | undefined;
    const hp = response.rules_result.hp as
      | {
          previous_hp?: number;
          damage?: number;
          remaining_hp?: number;
          defeated?: boolean;
        }
      | undefined;
    const lastResolution = attack
      ? {
          actorId: response.rules_result.actor_id as string | undefined,
          targetId: response.rules_result.target_id as string | undefined,
          combatFinished:
            (response.rules_result.combat_finished as boolean | undefined) ??
            encounter.combat_finished,
          attack: {
            roll: attack.roll,
            modifier: attack.modifier,
            total: attack.total,
            targetAc: attack.target_ac,
            hit: attack.hit,
            critical: attack.critical,
            nat20: attack.nat20,
            nat1: attack.nat1,
          },
          damage: damage
            ? {
                rolls: damage.rolls,
                modifier: damage.modifier,
                total: damage.total,
                critical: damage.critical,
              }
            : null,
          hp: hp
            ? {
                previousHp: hp.previous_hp,
                damage: hp.damage,
                remainingHp: hp.remaining_hp,
                defeated: hp.defeated,
              }
            : null,
        }
      : null;

    return {
      round: encounter.round_number,
      turnIndex: encounter.turn_index,
      activeActorId: encounter.active_participant_id,
      activeActor,
      initiativeOrder,
      participants: participantActors,
      heroes,
      enemies,
      combatFinished: encounter.combat_finished,
      turnControl: {
        requiresPlayerAction: activeActorIsHero,
        requiresDamageRoll: false,
        autoResolvable: activeActorIsEnemy,
        allowedActions: activeActorIsHero ? ["attack"] : [],
        availableTargets: activeActorIsHero
          ? enemies.filter((enemy) => !enemy.defeated)
          : heroes.filter((hero) => !hero.defeated),
      },
      hudEvents: response.hud_events,
      lastBackendEvents: response.hud_events,
      lastResolution,
      pendingDamage: null,
    };
  };

  const applyEncounterResolveResponse = (
    response: LegacySaveEncounterResolveResponse,
    fallbackStatus: string,
  ): FrontendEncounterState | null => {
    const frontendState =
      response.frontend_state ?? buildFrontendStateFromLegacyEncounter(response);

    if (!frontendState) {
      setCombatStatus("Backend-Antwort enthält keinen Encounter-State.");
      return null;
    }

    setInventoryState(response.state.inventory);
    applyFrontendEncounterState(frontendState);
    setSelectedCombatTargetId(null);
    const resolutionBelongsToActiveActor =
      frontendState.lastResolution?.actorId === frontendState.activeActorId;
    const nextStep =
      frontendState.turnControl?.requiresDamageRoll === true
        ? "awaitDamageRoll"
        : frontendState.lastResolution && resolutionBelongsToActiveActor
          ? "turnResolved"
          : frontendState.turnControl?.requiresPlayerAction
            ? "chooseAction"
            : frontendState.turnControl?.autoResolvable
              ? "enemyResolving"
              : "idle";

    setCombatAttackFlowState({
      actorId: frontendState.activeActorId,
      actionName: null,
      attackFormula: null,
      damageFormula: null,
      targetId: resolutionBelongsToActiveActor
        ? frontendState.lastResolution?.targetId ?? null
        : null,
      attackTotal: resolutionBelongsToActiveActor
        ? frontendState.lastResolution?.attack?.total ?? null
        : null,
      attackHit: resolutionBelongsToActiveActor
        ? frontendState.lastResolution?.attack?.hit ?? null
        : null,
      damageTotal: resolutionBelongsToActiveActor
        ? frontendState.lastResolution?.damage?.total ?? null
        : null,
      remainingHp: resolutionBelongsToActiveActor
        ? frontendState.lastResolution?.hp?.remainingHp ?? null
        : null,
      step: nextStep,
    });
    setCombatStatus(fallbackStatus);
    const resolutionAttack = frontendState.lastResolution?.attack;
    if (frontendState.lastResolution && resolutionAttack) {
      const resolution = frontendState.lastResolution;
      const actorName =
        frontendState.participants.find((actor) => actor.id === resolution.actorId)
          ?.name ??
        resolution.actorId ??
        "Unbekannt";
      const targetName =
        frontendState.participants.find((actor) => actor.id === resolution.targetId)
          ?.name ??
        resolution.targetId ??
        "Unbekannt";

      addGameLog({
        title: `${actorName} greift ${targetName} an`,
        detail: `Attack Roll ${resolutionAttack.total ?? "?"} gegen AC ${
          resolutionAttack.targetAc ?? "?"
        } - ${resolutionAttack.hit ? "Treffer" : "Verfehlt"}${
          resolution.damage
            ? ` | Schaden ${resolution.damage.total ?? 0} | HP ${
                resolution.hp?.remainingHp ?? "?"
              }`
            : ""
        }`,
        total: resolutionAttack.total ?? undefined,
      });
    }
    return frontendState;
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
      return false;
    }

    try {
      await createOrUpdateSave({
        slot_name: BACKEND_SLOT_NAME,
        character_id: toBackendCharacterId(selectedCharacterId),
        scene_number: getBackendSceneNumber(currentSceneId),
        state,
      });
      return true;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setCombatStatus(`Backend-Save nicht erreichbar: ${detail}`);
      addGameLog({
        title: "Backend-Save fehlgeschlagen",
        detail,
      });
      return false;
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
      const isSaveSynced = await syncBackendSave();
      if (!isSaveSynced) {
        setInventoryStatus(
          `${item.name}: Backend-Save nicht erreichbar, Aktion abgebrochen.`,
        );
        return;
      }
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
      const advanceResult = advanceCombatTurnState(currentState);

      if (!advanceResult) {
        return currentState;
      }

      setSelectedCombatTargetId(null);
      setCombatAttackFlowState(advanceResult.attackFlowState);

      return advanceResult.roundState;
    });
  };

  const resolveBackendCombatTurn = async (targetId?: string) => {
    if (!activeCombatActor || isBackendTurnResolving) {
      return;
    }

    setIsBackendTurnResolving(true);
    setCombatStatus("Backend loest den aktuellen Kampfrunden-Zug auf...");

    try {
      const isSaveSynced = await syncBackendSave();
      if (!isSaveSynced) {
        setDmMessages((messages) => [
          ...messages,
          {
            id: createId(),
            sender: "DM",
            text: "Der Gegnerzug kann nicht ausgewertet werden, weil der Encounter-Save das Backend nicht erreicht.",
          },
        ]);
        return;
      }
      const target =
        activeCombatActor.kind === "enemy"
          ? undefined
          : availableCombatTargets.find((item) => item.id === targetId) ??
            selectedCombatTarget;
      const needsHeroTarget = activeCombatActor.kind !== "enemy";

      if (needsHeroTarget && !target) {
        setCombatStatus("Bitte zuerst ein Ziel für den Angriff auswählen.");
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
      applyEncounterResolveResponse(
        response as LegacySaveEncounterResolveResponse,
        response.frontend_state
          ? "Backend-Zug aufgelöst. HUD und Kampfrunde wurden aktualisiert."
          : "Legacy-Backend: Zug wurde ausgewertet und der Kampfrunden-State aktualisiert.",
      );
    } catch (error) {
      setCombatStatus(
        "Backend-Auto-Turn nicht erreichbar. Zug bleibt unverändert.",
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
    setCombatStatus("Backend würfelt den Angriff gegen die Ziel-AC...");

    try {
      const isSaveSynced = await syncBackendSave();
      if (!isSaveSynced) {
        setDmMessages((messages) => [
          ...messages,
          {
            id: createId(),
            sender: "DM",
            text: "Der Attack Roll kann nicht ausgewertet werden, weil der Encounter-Save das Backend nicht erreicht.",
          },
        ]);
        return;
      }
      const action: EncounterAutoTurnAction = {
        action_type: "attack",
        actor_id:
          activeCombatActor.kind === "player"
            ? toBackendCharacterId(activeCharacter?.id ?? "ryu")
            : toBackendCharacterId(activeNpc?.id ?? "ayane"),
        target_id: selectedCombatTarget.id,
      };
      let response: LegacySaveEncounterResolveResponse;
      let usedLegacyAutoTurn = false;

      try {
        response = (await resolveSaveEncounterAttackRoll(
          BACKEND_SLOT_NAME,
          action,
        )) as LegacySaveEncounterResolveResponse;
      } catch (attackError) {
        if (
          attackError instanceof Error &&
          attackError.message.includes("Backend 404")
        ) {
          usedLegacyAutoTurn = true;
          response = (await resolveSaveEncounterAutoTurn(
            BACKEND_SLOT_NAME,
            action,
          )) as LegacySaveEncounterResolveResponse;
        } else {
          throw attackError;
        }
      }

      const frontendState = applyEncounterResolveResponse(
        response,
        usedLegacyAutoTurn
          ? "Legacy-Backend: Attack und Schaden wurden gemeinsam ausgewertet."
          : "Backend hat den Attack Roll ausgewertet.",
      );

      if (!frontendState) {
        return;
      }

      const attack = frontendState.lastResolution?.attack ?? null;
      const targetName = getCombatActorName(
        frontendState.lastResolution?.targetId ?? selectedCombatTarget.id,
      );
      const requiresDamageRoll =
        frontendState.turnControl?.requiresDamageRoll === true ||
        Boolean(frontendState.pendingDamage);
      const resolutionBelongsToActiveActor =
        frontendState.lastResolution?.actorId === frontendState.activeActorId;
      const nextStep =
        requiresDamageRoll
          ? "awaitDamageRoll"
          : resolutionBelongsToActiveActor
            ? "turnResolved"
            : frontendState.turnControl?.requiresPlayerAction
              ? "chooseAction"
              : frontendState.turnControl?.autoResolvable
                ? "enemyResolving"
                : "idle";

      setCombatAttackFlowState((currentState) => ({
        ...currentState,
        actorId: frontendState.activeActorId,
        actionName:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? currentState.actionName ?? combatAttackFlowState.actionName
            : null,
        targetId:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? frontendState.lastResolution?.targetId ?? selectedCombatTarget.id
            : null,
        attackTotal:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? attack?.total ?? null
            : null,
        attackHit:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? attack?.hit ?? null
            : null,
        damageTotal:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? frontendState.lastResolution?.damage?.total ?? null
            : null,
        remainingHp:
          requiresDamageRoll || resolutionBelongsToActiveActor
            ? frontendState.lastResolution?.hp?.remainingHp ?? null
            : null,
        step: nextStep,
      }));
      setCombatStatus(
        attack
          ? `${attack.total ?? "?"} gegen AC ${attack.targetAc ?? "?"}: ${
              attack.hit
                ? usedLegacyAutoTurn
                  ? "Treffer. Legacy-Backend hat Schaden direkt ausgewertet."
                  : "Treffer. Backend wartet auf Damage Roll."
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
            ? usedLegacyAutoTurn
              ? `${activeCombatActor.name} trifft ${targetName} mit ${combatAttackFlowState.actionName}. Schaden wurde vom Legacy-Backend direkt ausgewertet.`
              : `${activeCombatActor.name} trifft ${targetName} mit ${combatAttackFlowState.actionName}. Bitte würfle jetzt den Schaden.`
            : `${activeCombatActor.name} verfehlt ${targetName} mit ${combatAttackFlowState.actionName}. Der Zug kann beendet werden.`,
        },
      ]);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      setCombatStatus(`Backend-Attack-Roll nicht erreichbar: ${detail}`);
      setDmMessages((messages) => [
        ...messages,
        {
          id: createId(),
          sender: "DM",
          text: `Attack Roll konnte nicht ausgewertet werden: ${detail}`,
        },
      ]);
      addGameLog({
        title: "Backend-Attack-Roll fehlgeschlagen",
        detail,
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
    setCombatStatus("Backend würfelt den Schaden und aktualisiert HP...");

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

    if (options?.initiativeCharacterId && (isInitiativeScene || isCombatScene)) {
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
          id: "bandit",
          name: "Schattenräuber",
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
      const firstCombatActor = combatInitiativeOrder[0];
      const availableTargets = createInitialCombatEnemies().map((enemy) => ({
        id: enemy.id,
        participantId: enemy.id,
        name: enemy.name,
        kind: "enemy" as const,
        side: "enemies" as const,
        currentHp: enemy.currentHp,
        maxHp: enemy.maxHp,
        ac: enemy.ac,
        speed: enemy.speed,
        defeated: false,
      }));
      const initialTurnControl =
        firstCombatActor?.kind === "enemy"
          ? {
              requiresPlayerAction: false,
              autoResolvable: true,
              allowedActions: ["attack"],
              availableTargets: [],
            }
          : {
              requiresPlayerAction: true,
              autoResolvable: false,
              allowedActions: ["attack"],
              availableTargets,
            };

      setInitiativeOrder(combatInitiativeOrder);
      setCombatRoundState((currentState) => ({
        ...currentState,
        round: 1,
        activeActorId: firstCombatActor?.id ?? null,
        turnIndex: 0,
        initiativeOrder: combatInitiativeOrder,
        awaitingRoll: null,
        enemies: createInitialCombatEnemies(),
        turnControl: initialTurnControl,
      }));
      setSelectedCombatTargetId(null);
      setCombatAttackFlowState(
        createCombatAttackFlowStateForActor(firstCombatActor, 1),
      );
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void syncInventoryView();
  }, [inventoryState]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="h-dvh flex flex-col overflow-hidden text-white" style={{background: '#050505'}}>
      {/* HEADER */}
      <header className="relative flex-none h-14 flex items-center px-4 gap-3 border-b border-white/[0.08] z-40" style={{background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(20px)'}}>
        {/* Logo + nav */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Logo + campaign name */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src='/logo-eagle.svg' alt='Falkenwacht' width={28} height={28} style={{filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.5))'}} />

          </div>
          <nav className="hidden lg:flex items-center gap-0.5">
            <Link
              href="/campaigns"
              className="px-3 py-1.5 text-[0.68rem] font-bold font-cinzel rounded uppercase tracking-[0.12em] transition-all relative text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              Kampagne
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 text-[0.68rem] font-bold font-cinzel rounded uppercase tracking-[0.12em] transition-all text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              Login
            </Link>
            {isCombatScene ? (
              <Link
                href="/combat"
                className="px-3 py-1.5 text-[0.68rem] font-bold font-cinzel rounded uppercase tracking-[0.12em] transition-all text-red-400 hover:text-red-200 hover:bg-red-500/10"
                onClick={prepareCombatRouteHandoff}
              >
                Combat
              </Link>
            ) : null}
          </nav>
        </div>

        {/* Center title */}
        <div className="flex-1 text-center hidden md:block">
          <h1 className="text-base font-bold tracking-widest font-cinzel" style={{color: '#d4af37'}}>
            {CAMPAIGN_TITLE.replace(' - Die Korruption der Greifenstadt', '')}
            {currentScene.title !== 'Charakterwahl' ? `: ${currentScene.title}` : ''}
          </h1>
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <div className="w-12 h-px" style={{background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5))'}} />
            <div className="w-1.5 h-1.5 rotate-45" style={{background: '#d4af37', opacity: 0.7}} />
            <div className="w-12 h-px" style={{background: 'linear-gradient(90deg, rgba(212,175,55,0.5), transparent)'}} />
          </div>
        </div>

        {/* Right side - icon buttons + DM avatar */}
        <div className="flex items-center shrink-0 ml-auto">
          {/* Icon buttons */}
          <div className="flex items-center gap-1 mr-3">
            {([
              {icon: Dice5, label: 'Würfeln', onClick: () => setD20TriggerKey(k => k+1)},
              {icon: BookOpen, label: 'Regelwerk', onClick: () => setIsDmPanelOpen((o: boolean) => !o)},
              {icon: ClipboardList, label: 'Log', onClick: () => setIsLogPanelOpen((o: boolean) => !o)},
            ] as const).map(({icon: Icon, label, onClick}) => (
              <button
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[0.65rem] font-bold font-cinzel uppercase tracking-wide text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                onClick={onClick}
                type="button"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          {/* Vertical divider */}
          <div className="w-px h-6 mx-2" style={{background: 'rgba(255,255,255,0.1)'}} />
          {/* DM Avatar */}
          <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors" onClick={() => setIsDmPanelOpen((o) => !o)} type="button">
            <div className="relative">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{borderColor: 'rgba(212,175,55,0.4)'}}>
                <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-slate-300" />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border border-black" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[0.65rem] font-bold font-cinzel text-white leading-none">Spielmeister</p>
              <p className="text-[0.58rem] font-cinzel text-slate-400 leading-none mt-0.5 tracking-wider">DM</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          {isCombatScene ? (
            <Link className="ml-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[0.68rem] font-bold border border-red-400/40 bg-red-500/15 text-red-100 hover:border-red-300 transition-colors" href="/combat" onClick={prepareCombatRouteHandoff}>
              <Swords className="w-3 h-3" />
              Combat
            </Link>
          ) : null}
        </div>

        {/* Log dropdown */}
        {isLogPanelOpen ? (
          <div className="absolute right-4 top-16 z-50 max-h-96 w-96 overflow-y-auto rounded-lg border border-white/10 p-3 shadow-2xl" style={{background: 'rgba(5,5,5,0.98)', backdropFilter: 'blur(20px)'}}>
            <p className="mb-3 text-sm font-bold text-white">Game-Log</p>
            <div className="space-y-2">
              {gameLog.map((entry) => (
                <article className="rounded-md border border-white/[0.08] bg-white/[0.03] p-2 text-sm" key={entry.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-slate-200">{entry.title}</p>
                    {entry.total !== undefined ? (
                      <span className="rounded px-2 py-0.5 text-xs font-black text-black shrink-0" style={{background: '#d4af37'}}>{entry.total}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{entry.detail}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* MAIN 3-COLUMN */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr_320px]">
          {/* LEFT SIDEBAR */}
          <aside className="hidden lg:flex flex-col min-h-0 overflow-y-auto border-r border-white/[0.07]" style={{background: 'rgba(8,8,8,0.7)', backdropFilter: 'blur(8px)'}}>
            {/* Character name header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
              <p className="text-sm font-bold text-white font-cinzel tracking-wide">{activeCharacter?.name ?? 'Kein Charakter'}</p>
              {activeCharacter ? (
                <p className="text-[0.6rem] text-slate-500 mt-0.5 font-cinzel uppercase tracking-[0.14em]">Stufe {activeCharacter.level} {activeCharacter.className} ({activeCharacter.subclassName})</p>
              ) : null}
            </div>

            {activeCharacter && activeNpc && activeRuntimeStats && companionRuntimeStats ? (
              <>
                {/* Portrait */}
                <div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
                  <div className="relative rounded-lg overflow-hidden" style={{border: '1px solid rgba(212,175,55,0.5)', boxShadow: '0 0 25px rgba(212,175,55,0.2), inset 0 0 30px rgba(0,0,0,0.5)'}}>
                    <div className="h-48 bg-gradient-to-b from-white/5 to-black/80 flex items-end justify-center relative">
                      {/* Atmospheric overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`${activeCharacter.name} Portrait`}
                        className="relative z-10 max-h-48 w-auto object-contain drop-shadow-2xl"
                        src={activeCharacter.modelImageUrl}
                        style={{filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.3))'}}
                      />
                    </div>
                    {/* Gold corner accents */}
                    <div className="absolute top-1 left-1 w-3 h-3 border-t border-l" style={{borderColor: 'rgba(212,175,55,0.6)'}} />
                    <div className="absolute top-1 right-1 w-3 h-3 border-t border-r" style={{borderColor: 'rgba(212,175,55,0.6)'}} />
                    <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l" style={{borderColor: 'rgba(212,175,55,0.6)'}} />
                    <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r" style={{borderColor: 'rgba(212,175,55,0.6)'}} />
                  </div>
                </div>

                {/* HP / AC / SP bars */}
                <div className="px-4 py-3 space-y-2.5 border-b border-white/[0.07] shrink-0">
                  {/* HP */}
                  <div className="flex items-center gap-2.5">
                    <HeartPulse className="w-3.5 h-3.5 shrink-0" style={{color: '#ef4444'}} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500 font-cinzel">TP</span>
                        <span className="text-[0.68rem] font-bold text-white">{activeRuntimeStats.currentHp} / {activeRuntimeStats.maxHp}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-black/50">
                        <div className="h-full rounded-full transition-all duration-500" style={{width: `${Math.max(0, Math.min(100, (activeRuntimeStats.currentHp / activeRuntimeStats.maxHp) * 100))}%`, background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.5)'}} />
                      </div>
                    </div>
                  </div>
                  {/* AC */}
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{color: '#3b82f6'}} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500 font-cinzel">RK</span>
                        <span className="text-[0.68rem] font-bold text-white">{activeRuntimeStats.ac}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-black/50">
                        <div className="h-full rounded-full" style={{width: `${Math.max(0, Math.min(100, (activeRuntimeStats.ac / 20) * 100))}%`, background: '#3b82f6', boxShadow: '0 0 6px rgba(59,130,246,0.5)'}} />
                      </div>
                    </div>
                  </div>
                  {/* SP */}
                  <div className="flex items-center gap-2.5">
                    <Swords className="w-3.5 h-3.5 shrink-0" style={{color: '#a855f7'}} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500 font-cinzel">SP</span>
                        <span className="text-[0.68rem] font-bold text-white">{activeCharacter.stats.speed} / {activeCharacter.stats.speed}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-black/50">
                        <div className="h-full rounded-full" style={{width: '100%', background: '#a855f7', boxShadow: '0 0 6px rgba(168,85,247,0.5)'}} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="px-3 py-3 flex-1 overflow-y-auto">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.2)'}} />
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-slate-300 font-cinzel">Fertigkeiten</p>
                    <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.2)'}} />
                  </div>
                  {activeSheet ? (
                    <div className="grid grid-cols-2 gap-1">
                      {activeSheet.skills.map(([label, value]) => {
                        const skillMeta: Record<string, {attr: string; Icon: React.ElementType}> = {
                          Akrobatik:         {attr: 'GEW', Icon: Waves},
                          Heimlichkeit:      {attr: 'GEW', Icon: Wind},
                          Fingerfertigkeit:  {attr: 'GEW', Icon: HandMetal},
                          Athletik:          {attr: 'STÄ', Icon: Zap},
                          Wahrnehmung:       {attr: 'WEI', Icon: Scan},
                          Überzeugen:        {attr: 'CHA', Icon: Drama},
                          Einschüchtern:     {attr: 'CHA', Icon: Skull},
                          Überleben:         {attr: 'WEI', Icon: Flame},
                          Motivation:        {attr: 'WEI', Icon: Sparkles},
                          'Arkane Kunde':    {attr: 'INT', Icon: Star},
                          Acrobatics:        {attr: 'GEW', Icon: Waves},
                          'Animal Handling': {attr: 'WEI', Icon: Leaf},
                          Arcana:            {attr: 'INT', Icon: Sparkles},
                          Athletics:         {attr: 'STA', Icon: Zap},
                          Deception:         {attr: 'CHA', Icon: Drama},
                          History:           {attr: 'INT', Icon: ScrollText},
                          Insight:           {attr: 'WEI', Icon: Eye},
                          Intimidation:      {attr: 'CHA', Icon: Skull},
                          Investigation:     {attr: 'INT', Icon: Search},
                          Medicine:          {attr: 'WEI', Icon: FlaskConical},
                          Nature:            {attr: 'INT', Icon: Trees},
                          Perception:        {attr: 'WEI', Icon: Scan},
                          Performance:       {attr: 'CHA', Icon: Music},
                          Persuasion:        {attr: 'CHA', Icon: Star},
                          Religion:          {attr: 'INT', Icon: Snowflake},
                          'Sleight of Hand': {attr: 'GEW', Icon: HandMetal},
                          Stealth:           {attr: 'GEW', Icon: Wind},
                          Survival:          {attr: 'WEI', Icon: Flame},
                        };
                        const meta = skillMeta[label] ?? {attr: 'GEW', Icon: Feather};
                        const { attr } = meta;
                        const SkillIcon = meta.Icon as React.ComponentType<{className?: string; style?: React.CSSProperties}>;
                        const isPending = pendingSkillNames.has(label);
                        return (
                          <button
                            className="min-w-0 rounded-md px-2 py-2 text-left text-[0.6rem] transition-all hover:bg-white/10 flex items-center gap-2"
                            key={label}
                            onClick={() => rollFormula(`${activeCharacter.name} ${label}`, `1d20${value}`, { skill: label })}
                            style={{background: isPending ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)', border: isPending ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.07)'}}
                            type="button"
                          >
                            <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{background: isPending ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.07)'}}>
                              <SkillIcon className="w-3 h-3" style={{color: isPending ? '#d4af37' : '#94a3b8'}} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block truncate text-slate-200 text-[0.65rem] font-semibold leading-tight">{label}</span>
                              <span className="text-[0.58rem] text-slate-400 leading-tight font-cinzel tracking-wide uppercase">{attr}</span>
                            </div>
                            <span className="font-black text-[0.72rem] shrink-0" style={{color: isPending ? '#d4af37' : '#e2e8f0'}}>{value}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Details + expanded sheet */}
                <div className="px-4 py-3 border-t border-white/[0.07] shrink-0">
                  <button
                    className="w-full rounded py-2 text-[0.65rem] font-semibold text-slate-500 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-1.5 font-cinzel uppercase tracking-wider"
                    onClick={() => setIsSheetExpanded((e) => !e)}
                    type="button"
                  >
                    Details anzeigen <ChevronDown className={`w-3 h-3 transition ${isSheetExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isSheetExpanded && activeSheet ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[0.62rem] uppercase tracking-wider text-slate-400 mb-1.5 font-cinzel tracking-[0.2em]">Aktionen</p>
                        <div className="space-y-1.5">
                          {activeSheet.actions.map((action) => (
                            <div className="rounded border border-white/[0.08] bg-white/[0.03] p-2" key={action.name}>
                              <p className="text-xs font-bold text-white">{action.name}</p>
                              <p className="text-[0.62rem] text-slate-400 mt-0.5">{action.note}</p>
                              <div className="mt-1.5 grid grid-cols-2 gap-1">
                                <button
                                  className="rounded border border-white/[0.08] bg-white/[0.05] px-1 py-1.5 text-[0.6rem] font-bold hover:bg-white/10 transition-colors text-slate-200"
                                  onClick={() => {
                                    if (isCombatScene && combatAttackFlowState.step === 'awaitAttackRoll' && combatAttackFlowState.actionName === action.name && selectedCombatTarget) {
                                      void rollCombatAttack();
                                      return;
                                    }
                                    rollFormula(`${action.name} Angriff`, `1d20+${action.attack}`);
                                  }}
                                  type="button"
                                >
                                  Hit +{action.attack}
                                </button>
                                <button
                                  className="rounded border border-white/[0.08] bg-white/[0.05] px-1 py-1.5 text-[0.6rem] font-bold hover:bg-white/10 transition-colors text-slate-200"
                                  onClick={() => rollFormula(`${action.name} Schaden`, action.damage)}
                                  type="button"
                                >
                                  {action.damage}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[0.62rem] uppercase tracking-wider text-slate-400 mb-1.5 font-cinzel tracking-[0.2em]">Inventory</p>
                        {inventoryItems.length > 0 ? (
                          <div className="space-y-1">
                            {inventoryItems.map((item) => (
                              <div className="rounded border border-white/[0.08] bg-white/[0.03] p-2" key={item.item_id}>
                                <p className="text-xs font-bold text-white">{item.name}</p>
                                <p className="text-[0.62rem] text-slate-400">Menge {item.quantity}{item.equipped ? ' · ausgerüstet' : ''}</p>
                                <div className="mt-1 grid grid-cols-2 gap-1">
                                  {(item.actions ?? []).slice(0, 4).map((action) => (
                                    <button className="rounded border border-white/[0.08] bg-white/[0.05] px-1 py-1 text-[0.58rem] font-semibold hover:bg-white/10 transition-colors text-slate-300" key={action} onClick={() => handleInventoryAction(item, action)} type="button">
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[0.62rem] text-slate-400">Wird geladen...</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Companion mini */}
                <div className="px-4 py-2.5 border-t border-white/[0.07] shrink-0">
                  <div className="flex items-center gap-2.5 rounded-lg px-2 py-2" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-black/40 flex items-end justify-center">
                      <Image alt={activeNpc.name} className="max-h-8 object-contain" height={40} src={activeNpc.modelImageUrl} width={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.65rem] font-bold text-slate-300 truncate font-cinzel">{activeNpc.name}</p>
                      <p className="text-[0.62rem] text-slate-400 font-cinzel uppercase tracking-wider">Begleitung</p>
                    </div>
                    <div className="flex gap-1 shrink-0 text-[0.58rem] font-bold">
                      <span className="rounded px-1 py-0.5 bg-red-500/15 text-red-200">{companionRuntimeStats.currentHp}</span>
                      <span className="rounded px-1 py-0.5 bg-white/5 text-slate-300">AC{companionRuntimeStats.ac}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom chat bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.07] shrink-0">
                  <button className="text-slate-600 hover:text-slate-400 transition-colors" onClick={() => setIsDmPanelOpen((o) => !o)} type="button">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button className="text-slate-600 hover:text-slate-400 transition-colors" type="button">
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button className="text-slate-600 hover:text-slate-400 transition-colors" type="button">
                    <Music className="w-4 h-4" />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      className="w-full h-7 rounded border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-white placeholder:text-slate-700 outline-none focus:border-white/15"
                      onChange={(e) => setDmInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { void sendDmMessage(); }}}
                      placeholder="Nachricht eingeben..."
                      value={dmInput}
                    />
                  </div>
                  <button className="flex items-center justify-center w-7 h-7 rounded text-black shrink-0 transition-opacity hover:opacity-90" onClick={() => void sendDmMessage()} style={{background: '#d4af37'}} type="button">
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 p-6 text-center">
                <p className="text-slate-400 text-sm">Charakter wird ausgewählt...</p>
              </div>
            )}

            {/* Legacy content - hidden */}
            <div className="hidden">
                  {isSheetExpanded && activeSheet ? (
                    <div className="space-y-2 border-t border-white/10 p-2">
                      <button
                        className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-2 py-2 text-left text-xs transition hover:border-ember-400"
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter!.name} Initiative`,
                            `1d20+${activeCharacter!.stats.initiative}`,
                            { initiativeCharacterId: activeCharacter!.id },
                          )
                        }
                        type="button"
                      >
                        Initiative +{activeCharacter!.stats.initiative}
                      </button>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Skills
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {activeSheet!.skills.map(([label, value]) => (
                            <button
                              className={`min-w-0 rounded-md border px-2 py-1.5 text-left text-[0.68rem] transition hover:border-ember-400/70 ${
                                pendingSkillNames.has(label)
                                  ? "border-ember-400 bg-ember-500/20 shadow-glow"
                                  : "border-white/10 bg-white/[0.05]"
                              }`}
                              key={label}
                              onClick={() =>
                                rollFormula(
                                  `${activeCharacter!.name} ${label}`,
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
                        {activeSheet!.actions.map((action) => (
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
                                onClick={() => {
                                  if (
                                    isCombatScene &&
                                    combatAttackFlowState.step ===
                                      "awaitAttackRoll" &&
                                    combatAttackFlowState.actionName ===
                                      action.name &&
                                    selectedCombatTarget
                                  ) {
                                    void rollCombatAttack();
                                    return;
                                  }

                                  rollFormula(
                                    `${action.name} Angriff`,
                                    `1d20+${action.attack}`,
                                  );
                                }}
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
                <div><article>
                </article>
                {activeNpc ? <article
                  className={`overflow-hidden rounded-md border border-white/10 bg-white/[0.05] ${
                    isCompanionExpanded ? "col-span-2" : ""
                  }`}
                >
                  <div className="flex h-32 items-end justify-center bg-gradient-to-b from-white/10 to-black/40">
                    <Image
                      alt={`${activeNpc!.name} Portrait`}
                      className="max-h-32 object-contain drop-shadow-2xl"
                      height={190}
                      src={activeNpc!.modelImageUrl}
                      width={150}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-white/10 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{activeNpc!.name}</p>
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">
                        Begleitung
                      </p>
                    </div>
                    <button
                      aria-label={`${activeNpc!.name} Sheet umschalten`}
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
                      HP {companionRuntimeStats!.currentHp}/{companionRuntimeStats!.maxHp}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      AC {companionRuntimeStats!.ac}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1 py-1 text-[0.62rem] font-bold text-slate-100">
                      SP {activeNpc!.stats.speed}
                    </span>
                  </div>
                  {isCompanionExpanded && companionSheet ? (
                    <div className="space-y-2 border-t border-white/10 p-2">
                      <button
                        className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-2 py-2 text-left text-xs transition hover:border-ember-400"
                        onClick={() =>
                          rollFormula(
                            `${activeNpc!.name} Initiative`,
                            `1d20+${activeNpc!.stats.initiative}`,
                            { initiativeCharacterId: activeNpc!.id },
                          )
                        }
                        type="button"
                      >
                        Initiative +{activeNpc!.stats.initiative}
                      </button>
                      <div className="space-y-1">
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
                          Aktionen
                        </p>
                        {companionSheet!.actions.map((action) => (
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
                                onClick={() => {
                                  if (
                                    isCombatScene &&
                                    combatAttackFlowState.step ===
                                      "awaitAttackRoll" &&
                                    combatAttackFlowState.actionName ===
                                      action.name &&
                                    selectedCombatTarget
                                  ) {
                                    void rollCombatAttack();
                                    return;
                                  }

                                  rollFormula(
                                    `${activeNpc!.name} ${action.name} Angriff`,
                                    `1d20+${action.attack}`,
                                  );
                                }}
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
                                    `${activeNpc!.name} ${action.name} Schaden`,
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
                </article> : null}
              </div>
            </div>{/* close legacy hidden div */}

            {false ? (
              <div className="hidden space-y-3">
                <div className="hidden overflow-hidden rounded-md border border-white/10 bg-black/35">
                  <div className="flex h-40 items-end justify-center bg-gradient-to-b from-white/5 to-transparent">
                    <Image
                      alt={`${activeCharacter!.name} Charakterbild`}
                      className="max-h-40 object-contain drop-shadow-2xl"
                      height={220}
                      src={activeCharacter!.modelImageUrl}
                      width={180}
                    />
                  </div>
                  <div className="border-t border-white/10 p-2">
                    <p className="text-sm font-bold">{activeCharacter!.name}</p>
                    <p className="text-xs text-slate-400">
                      Level {activeCharacter!.level} {activeCharacter!.className} ·{" "}
                      {activeCharacter!.subclassName}
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
                      {activeCharacter!.stats.speed} ft.
                    </p>
                  </div>
                </div>

                <button
                  className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-left transition hover:border-ember-400"
                  onClick={() =>
                    rollFormula(
                      `${activeCharacter!.name} Initiative`,
                      `1d20+${activeCharacter!.stats.initiative}`,
                      { initiativeCharacterId: activeCharacter!.id },
                    )
                  }
                  type="button"
                >
                  <span className="block text-xs text-slate-400">
                    Initiative würfeln
                  </span>
                  <span className="text-sm font-bold">
                    +{activeCharacter!.stats.initiative}
                  </span>
                </button>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    Saving Throws
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {activeSheet!.saves.map(([label, value]) => (
                      <button
                        className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-left text-xs transition hover:border-ember-400/70"
                        key={label}
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter!.name} ${label}`,
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
                    {activeSheet!.skills.map(([label, value]) => (
                      <button
                        className={`w-full rounded-md border px-2 py-2 text-left text-xs transition hover:border-ember-400/70 ${
                          pendingSkillNames.has(label)
                            ? "border-ember-400 bg-ember-500/20 shadow-glow"
                            : "border-white/10 bg-white/[0.05]"
                        }`}
                        key={label}
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter!.name} ${label}`,
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
                    {activeSheet!.actions.map((action) => (
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

            {false && activeNpc && companionSheet && isCompanionExpanded ? (
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
                      alt={`${activeNpc!.name} Begleiterbild`}
                      className="max-h-12 object-contain drop-shadow-xl"
                      height={72}
                      src={activeNpc!.modelImageUrl}
                      width={56}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                      NPC-Begleitung
                    </p>
                    <p className="truncate text-sm font-bold">{activeNpc!.name}</p>
                    <p className="line-clamp-2 text-xs text-slate-400">
                      Level {activeNpc!.level} {activeNpc!.className} ·{" "}
                      {activeNpc!.subclassName}
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
                      {activeNpc!.stats.speed}
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
                          alt={`${activeNpc!.name} Begleiterbild`}
                          className="max-h-24 object-contain drop-shadow-2xl"
                          height={180}
                          src={activeNpc!.modelImageUrl}
                          width={140}
                        />
                      </div>
                      <div className="border-l border-white/10 p-2">
                        <p className="text-sm font-bold">{activeNpc!.name}</p>
                        <p className="text-xs text-slate-400">
                          Level {activeNpc!.level} {activeNpc!.className} ·{" "}
                          {activeNpc!.subclassName}
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
                            {activeNpc!.stats.speed} ft.
                          </p>
                        </div>
                    </div>

                    <button
                      className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-left transition hover:border-ember-400"
                      onClick={() =>
                        rollFormula(
                          `${activeNpc!.name} Initiative`,
                          `1d20+${activeNpc!.stats.initiative}`,
                          { initiativeCharacterId: activeNpc!.id },
                        )
                      }
                      type="button"
                    >
                      <span className="block text-xs text-slate-400">
                        Initiative würfeln
                      </span>
                      <span className="text-sm font-bold">
                        +{activeNpc!.stats.initiative}
                      </span>
                    </button>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                        Aktionen
                      </p>
                      <div className="space-y-2">
                        {companionSheet!.actions.map((action) => (
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
                                    `${activeNpc!.name} ${action.name} Angriff`,
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
                                    `${activeNpc!.name} ${action.name} Schaden`,
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

          {/* CENTER */}
          <main className="flex flex-col min-h-0 overflow-hidden relative">
            {/* Scene info bar */}
            <div className="flex-none px-4 py-2 border-b border-white/[0.06] flex items-center gap-2.5 shrink-0" style={{background: 'rgba(6,6,6,0.9)'}}>
              <BookOpen className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <p className="text-[0.65rem] text-slate-500 truncate">{currentScene.chapter} · <span className="text-slate-300 font-semibold">{currentScene.title}</span></p>
            </div>

            {/* Scene image area - no narrative inside */}
            <div className="flex-1 relative overflow-hidden" style={{minHeight: 0}}>
              <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: `url('${currentScene.imageUrl}')`}} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
              <div className="absolute inset-0 p-0">
          <>
            {isCombatScene && combatRoundState.round > 0 ? (
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
              <div className="absolute inset-0 grid items-stretch gap-4 lg:grid-cols-2 p-4">
                {(["ryu", "ayane"] as CharacterId[]).map((characterId) => {
                  const character = characters[characterId];

                  return (
                    <button
                      className="group flex min-h-0 flex-col overflow-hidden rounded-xl text-left transition-all hover:scale-[1.02] fantasy-border"
                      style={{background: 'rgba(5,5,5,0.9)'}}
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
                        <span className="block text-xl font-bold font-cinzel tracking-wide" style={{color: '#d4af37'}}>
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
            ) : null}

          {!isCharacterSelection ? (
            <div className="hidden min-h-20 space-y-2 overflow-y-auto border-t border-white/10 bg-ink-950/95 p-2">
              {!isCombatScene && pendingCheck ? (
                <div className="rounded-lg px-3 py-2.5 text-sm" style={{background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.22)'}}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1 h-1 rotate-45 shrink-0" style={{background: 'rgba(212,175,55,0.7)'}} />
                    <p className="font-bold font-cinzel text-[0.65rem] uppercase tracking-[0.16em]" style={{color: '#d4af37'}}>
                      DM wartet auf Wurf
                    </p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
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
          </>
              </div>
            {/* Narrative overlay - absolute bottom inside scene image */}
            {!isCharacterSelection ? (
              <div className="absolute bottom-0 left-0 right-0 z-20" style={{background: 'linear-gradient(to top, rgba(2,2,2,0.99) 0%, rgba(2,2,2,0.92) 55%, rgba(2,2,2,0.4) 82%, transparent 100%)'}}>
                {/* Cinematic subtitle */}
                <div
                  className="px-8 pb-5 pt-3 cursor-pointer"
                  onClick={() => { if (!isDialogueFullyVisible) setVisibleWordCount(dialogueWords.length); }}
                >
                  {/* Speaker label — small, gold, centered */}
                  <p className="text-center mb-1.5 text-[0.52rem] font-cinzel uppercase tracking-[0.3em]" style={{color: 'rgba(201,168,76,0.7)'}}>
                    {currentDialogueLine.speaker}
                  </p>

                  {/* Dialogue text — cinematic, centered */}
                  <p className="text-center font-semibold leading-[1.75]" style={{fontSize: '1.05rem', color: '#f0e6cc', textShadow: '0 2px 16px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.9)', whiteSpace: 'pre-wrap', letterSpacing: '0.015em'}}>
                    {dialogueWords.map((word, index) => (
                      <span
                        className={`transition-opacity duration-150 ${index < visibleWordCount ? 'opacity-100' : 'opacity-0'}`}
                        key={`${word}-${index}`}
                      >
                        {word + (index < dialogueWords.length - 1 ? ' ' : '')}
                      </span>
                    ))}
                  </p>

                  {/* Weiter / skip */}
                  <div className="mt-3 flex justify-center min-h-[1.5rem]">
                    {!isDialogueFullyVisible ? (
                      <p className="text-[0.44rem] animate-pulse font-cinzel tracking-[0.3em] uppercase" style={{color: 'rgba(201,168,76,0.3)'}}>Tippen zum Überspringen</p>
                    ) : !isLastDialogueLine ? (
                      <button
                        aria-label="Continue"
                        className="flex items-center gap-1 px-5 py-1.5 text-[0.6rem] font-bold font-cinzel tracking-[0.18em] uppercase transition-all hover:brightness-110 active:scale-95"
                        onClick={(e) => { e.stopPropagation(); continueDialogue(); }}
                        style={{
                          background: 'linear-gradient(135deg, #c9a84c 0%, #9a6e1e 100%)',
                          color: '#150c00',
                          borderRadius: '3px',
                          boxShadow: '0 0 18px rgba(180,140,40,0.5)',
                        }}
                        type="button"
                      >
                        Weiter <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Story choices */}
                {isLastDialogueLine && isDialogueFullyVisible && !isCombatScene && currentScene.choices.length > 0 ? (
                  <div className="px-8 pb-4 space-y-1.5">
                    {currentScene.choices.map((choice) => (
                      <button
                        className="w-full rounded px-4 py-2 text-left text-sm font-semibold text-slate-100 transition-all"
                        key={choice.id}
                        onClick={() => chooseAction(choice)}
                        style={{background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(201,168,76,0.25)', backdropFilter: 'blur(4px)'}}
                        type="button"
                      >
                        <span className="mr-2" style={{color: '#d4af37'}}>›</span>
                        {choice.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
                        </div>{/* close flex-1 relative */}
          </main>{/* close center */}

          {/* RIGHT SIDEBAR */}
          <aside className="hidden lg:flex flex-col min-h-0 overflow-hidden border-l border-white/[0.07]" style={{background: 'rgba(8,8,8,0.7)', backdropFilter: 'blur(8px)'}}>
            {/* Spieler-Aktionen header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.15)'}} />
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-slate-500 font-cinzel">Spieleraktionen</p>
                <div className="w-1 h-1 rotate-45" style={{background: 'rgba(212,175,55,0.4)'}} />
                <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.15)'}} />
              </div>
            </div>

            {/* Non-combat action grid — hidden when story choices are ready so they get full space */}
            {saveRestored && !isCombatScene && !(isLastDialogueLine && isDialogueFullyVisible && !isCharacterSelection) ? (
              <div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {icon: Dice5, label: 'Würfeln', sub: 'W20', color: '#d4af37', onClick: () => setD20TriggerKey(k => k+1)},
                    {icon: BookOpen, label: 'Nachschlagen', sub: 'Regelwerk', color: '#94a3b8', onClick: () => setIsDmPanelOpen((o: boolean) => !o)},
                    {icon: Search, label: 'Untersuchen', sub: 'Umgebung', color: '#94a3b8', onClick: undefined},
                    {icon: HandMetal, label: 'Interagieren', sub: 'Objekt / NSC', color: '#94a3b8', onClick: undefined},
                  ] as const).map(({icon: Icon, label, sub, color, onClick}) => (
                    <button
                      className="rounded-lg p-3 flex flex-col items-start gap-1.5 transition-all hover:bg-white/10"
                      key={label}
                      onClick={onClick}
                      style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}
                      type="button"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background: 'rgba(255,255,255,0.07)'}}>
                        <Icon className="w-4 h-4" style={{color}} />
                      </div>
                      <p className="text-[0.68rem] font-bold text-white leading-tight font-cinzel uppercase tracking-wide">{label}</p>
                      <p className="text-[0.65rem] text-slate-400 leading-tight">{sub}</p>
                    </button>
                  ))}
                  <button
                    className="col-span-2 rounded-lg p-3.5 flex items-center gap-3 transition-all hover:bg-white/10"
                    style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}
                    type="button"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{background: 'rgba(255,255,255,0.06)'}}>
                      <Hourglass className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white font-cinzel uppercase tracking-wide">Zug Beenden</p>
                      <p className="text-[0.62rem] text-slate-400 font-cinzel">Runde beenden</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {/* Story choices */}
              {!isCharacterSelection && !isCombatScene && isLastDialogueLine && isDialogueFullyVisible ? (
                <div className="space-y-2">
                  <p className="text-[0.55rem] uppercase tracking-[0.28em] text-slate-500 font-cinzel">Aktionen</p>
                  {currentScene.choices.map((choice) => renderChoiceButton(choice))}
                </div>
              ) : null}
              {isCombatScene && visibleInitiativeOrder.length === 0 ? (
                <div className="space-y-3 rounded-lg p-4" style={{background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.18)'}}>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rotate-45 shrink-0" style={{background: 'rgba(212,175,55,0.7)'}} />
                    <p className="text-[0.7rem] font-black font-cinzel uppercase tracking-[0.18em]" style={{color: '#d4af37'}}>
                      Initiative starten
                    </p>
                    <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.15)'}} />
                  </div>
                  <p className="text-[0.72rem] leading-relaxed text-slate-300">
                    {initiativeStatus} Würfle die Initiative für jeden Charakter. Die Reihenfolge wird danach aufgebaut.
                  </p>
                  <div className="grid gap-2">
                    {activeCharacter ? (
                      <button
                        className="rounded-lg px-4 py-2.5 text-left text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={initiativeRolls[activeCharacter.id] !== undefined}
                        onClick={() =>
                          rollFormula(
                            `${activeCharacter.name} Initiative`,
                            `1d20+${activeCharacter.stats.initiative}`,
                            { initiativeCharacterId: activeCharacter.id },
                          )
                        }
                        style={initiativeRolls[activeCharacter.id] !== undefined
                          ? {background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8'}
                          : {background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', color: '#f0e6cc'}}
                        type="button"
                      >
                        {activeCharacter.name} Initiative
                        {initiativeRolls[activeCharacter.id] !== undefined
                          ? `: ${initiativeRolls[activeCharacter.id]}`
                          : ` +${activeCharacter.stats.initiative}`}
                      </button>
                    ) : null}
                    {activeNpc ? (
                      <button
                        className="rounded-lg px-4 py-2.5 text-left text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={initiativeRolls[activeNpc.id] !== undefined}
                        onClick={() =>
                          rollFormula(
                            `${activeNpc.name} Initiative`,
                            `1d20+${activeNpc.stats.initiative}`,
                            { initiativeCharacterId: activeNpc.id },
                          )
                        }
                        style={initiativeRolls[activeNpc.id] !== undefined
                          ? {background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8'}
                          : {background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#e2e8f0'}}
                        type="button"
                      >
                        {activeNpc.name} Initiative
                        {initiativeRolls[activeNpc.id] !== undefined
                          ? `: ${initiativeRolls[activeNpc.id]}`
                          : ` +${activeNpc.stats.initiative}`}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {isCombatScene && visibleInitiativeOrder.length > 0 ? (
                <div className="space-y-2.5 rounded-lg p-3" style={{background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)'}}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] font-cinzel" style={{color: '#d4af37'}}>
                      Initiative
                    </p>
                    {combatRoundState.round > 0 ? (
                      <span className="rounded px-2.5 py-1 text-xs font-black" style={{background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#f0e6cc'}}>
                        Runde {combatRoundState.round}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5">
                    {visibleInitiativeOrder.map((actor, index) => (
                      <div
                        className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-bold"
                        style={actor.id === combatRoundState.activeActorId
                          ? {background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.5)', color: '#f0e6cc'}
                          : actor.kind === "enemy"
                            ? {background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fecaca'}
                            : {background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0'}}
                        key={actor.id}
                      >
                        <span className="grid size-6 place-items-center rounded border border-current/25 text-[0.65rem]">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{actor.name}</span>
                          <span className="block text-[0.62rem] font-black uppercase tracking-[0.1em] opacity-70">
                            {actor.id === combatRoundState.activeActorId
                              ? "Am Zug"
                              : actor.kind === "enemy"
                                ? "Gegner"
                                : actor.kind === "companion"
                                  ? "Begleiter"
                                  : "Held"}
                          </span>
                        </span>
                        <span className="rounded border border-current/20 px-2 py-0.5 text-xs font-black">
                          {actor.total !== undefined ? actor.total : "DM"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {combatRoundState.round > 0 ? (
                    <div className="rounded-md p-2" style={{background: 'rgba(8,8,18,0.85)', border: '1px solid rgba(212,175,55,0.15)', boxShadow: '0 0 20px rgba(212,175,55,0.06)'}}>
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
                      {lastCombatSummary ? (
                        <div
                          className={`mt-2 rounded-md border px-2 py-2 text-xs ${
                            lastCombatSummary.isEnemyAction
                              ? lastCombatSummary.hit
                                ? "border-red-400/45 bg-red-500/15 text-red-50"
                                : "border-slate-400/25 bg-white/[0.06] text-slate-100"
                              : lastCombatSummary.hit
                                ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-50"
                                : "border-slate-400/25 bg-white/[0.06] text-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-slate-400 font-cinzel">
                                Letzte Aktion
                              </p>
                              <p className="mt-1 text-sm font-black text-slate-50">
                                {lastCombatSummary.actorName}{" "}
                                {lastCombatSummary.hit
                                  ? "trifft"
                                  : "verfehlt"}{" "}
                                {lastCombatSummary.targetName}
                              </p>
                            </div>
                            <span
                              className="shrink-0 rounded px-2 py-1 text-[0.68rem] font-black"
                              style={lastCombatSummary.hit
                                ? {background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.4)', color: '#f0e6cc'}
                                : {background: 'rgba(100,116,139,0.3)', border: '1px solid rgba(100,116,139,0.3)', color: '#e2e8f0'}}
                            >
                              {lastCombatSummary.hit ? "Treffer" : "Miss"}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                            <span className="rounded border border-white/10 bg-black/25 px-1.5 py-1">
                              <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400 font-cinzel">
                                Attack
                              </span>
                              <span className="text-sm font-black">
                                {lastCombatSummary.total}
                              </span>
                            </span>
                            <span className="rounded border border-white/10 bg-black/25 px-1.5 py-1">
                              <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400 font-cinzel">
                                AC
                              </span>
                              <span className="text-sm font-black">
                                {lastCombatSummary.targetAc}
                              </span>
                            </span>
                            <span className="rounded border border-white/10 bg-black/25 px-1.5 py-1">
                              <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400 font-cinzel">
                                Schaden
                              </span>
                              <span className="text-sm font-black">
                                {lastCombatSummary.hit
                                  ? lastCombatSummary.damage
                                  : 0}
                              </span>
                            </span>
                          </div>
                          {lastCombatSummary.hit ? (
                            <p className="mt-2 rounded border border-white/10 bg-black/25 px-2 py-1 font-bold text-slate-100">
                              {lastCombatSummary.critical ? "Kritischer Treffer. " : ""}
                              HP danach:{" "}
                              {lastCombatSummary.remainingHp ?? "unbekannt"}
                            </p>
                          ) : (
                            <p className="mt-2 rounded border border-white/10 bg-black/25 px-2 py-1 font-bold text-slate-300">
                              Kein Schaden bei Miss.
                            </p>
                          )}
                        </div>
                      ) : null}
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[0.58rem] font-black uppercase tracking-[0.08em]">
                        <span
                          className="rounded border px-1 py-1"
                          style={combatAttackFlowState.step === "chooseAction"
                            ? {background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.45)', color: '#f0e6cc'}
                            : {background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b'}}
                        >
                          1 Aktion
                        </span>
                        <span
                          className="rounded border px-1 py-1"
                          style={combatAttackFlowState.step === "chooseTarget"
                            ? {background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.45)', color: '#f0e6cc'}
                            : {background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b'}}
                        >
                          2 Ziel
                        </span>
                        <span
                          className="rounded border px-1 py-1"
                          style={combatAttackFlowState.step === "awaitAttackRoll" || combatAttackFlowState.step === "awaitDamageRoll"
                            ? {background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#a7f3d0'}
                            : combatAttackFlowState.step === "turnResolved"
                              ? {background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1'}
                              : {background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b'}}
                        >
                          3 Roll
                        </span>
                      </div>
                      <p className="mt-2 rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[0.68rem] font-semibold text-slate-300">
                        {combatFlowStepCopy[combatAttackFlowState.step]}
                      </p>
                      {combatStatus ? (
                        <p className="mt-2 rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5 text-[0.68rem] font-semibold text-emerald-100">
                          {combatStatus}
                        </p>
                      ) : null}
                      {combatRoundState.turnControl?.requiresPlayerAction &&
                      combatAttackFlowState.step === "chooseAction" ? (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/30 p-2">
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] font-cinzel" style={{color: 'rgba(212,175,55,0.8)'}}>
                            1. Aktion waehlen
                          </p>
                          <div className="mt-1 grid gap-1.5">
                            {activeCombatActions.map((action) => (
                              <button
                                className="rounded-md px-2 py-2 text-left transition"
                                style={{background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)'}}
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
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] font-cinzel" style={{color: 'rgba(212,175,55,0.8)'}}>
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
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold transition"
                                style={selectedCombatTargetId === target.id
                                  ? {background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.45)', color: '#f0e6cc'}
                                  : {background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0'}}
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
                        className="mt-2 w-full rounded-md px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 font-cinzel uppercase tracking-wide"
                        style={{background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.45)', color: '#f0e6cc', boxShadow: '0 0 12px rgba(212,175,55,0.15)'}}
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
                                  ? `3. Angriff würfeln (${combatAttackFlowState.attackFormula})`
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
                        <div className="mt-2 rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1.5 text-[0.68rem] text-red-50">
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
                        <div className="mt-2 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5 text-[0.68rem] text-emerald-50">
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


            {/* Quest-Log */}
            <div className="px-3 py-3 border-t border-white/[0.07] shrink-0">
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.15)'}} />
                <p className="text-[0.55rem] font-bold uppercase tracking-[0.28em] text-slate-500 font-cinzel">Quest-Log</p>
                <div className="flex-1 h-px" style={{background: 'rgba(212,175,55,0.15)'}} />
              </div>
              <div className="space-y-1.5">
                {/* Active quest */}
                <div className="rounded-lg p-2.5 flex items-start gap-2.5" style={{background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)'}}>
                  <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)'}}>
                    <ScrollText className="w-3.5 h-3.5" style={{color: '#d4af37'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.7rem] font-bold text-white font-cinzel tracking-wide">Das gestohlene Ei</p>
                    <p className="text-[0.58rem] text-slate-500 mt-0.5 leading-relaxed">Findet das gestohlene Ei, bevor es in falsche Hände gerät.</p>
                  </div>
                  <div className="shrink-0 w-2.5 h-2.5 rotate-45 mt-1" style={{background: '#d4af37', boxShadow: '0 0 5px rgba(212,175,55,0.5)'}} />
                </div>
                {/* Inactive quests */}
                {[
                  {icon: ShieldCheck, title: 'Intrigen in Falkenwacht', desc: 'Untersucht die politische Lage in der Stadt und gewinnt Verbündete.'},
                  {icon: Swords, title: 'Der Schatten im Rat', desc: 'Findet Hinweise auf den Verräter im Rat der Vier.'},
                ].map(({icon: Icon, title, desc}) => (
                  <div className="rounded-lg p-2.5 flex items-start gap-2.5" key={title} style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'}}>
                      <Icon className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.7rem] font-bold text-slate-500 font-cinzel tracking-wide">{title}</p>
                      <p className="text-[0.58rem] text-slate-700 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    <div className="shrink-0 w-3 h-3 rounded-full mt-1 border border-slate-700" />
                  </div>
                ))}
              </div>
              <button className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[0.6rem] font-semibold text-slate-600 hover:text-slate-400 transition-colors border border-white/[0.06] rounded-lg hover:bg-white/5 font-cinzel uppercase tracking-wider" type="button">
                Alle Quests anzeigen
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </div>


          </aside>
        </div>

      {/* Floating D20 — bottom-right of center column, beside the narrow dialogue box */}
      <div className="fixed z-50" style={{bottom:'72px', right:'332px', filter:'drop-shadow(0 0 16px rgba(80,120,255,0.4))'}}>
        <D20Component
          currentValue={rollResult?.total ?? null}
          rollTrigger={d20TriggerKey}
          onRoll={(val) => {
            const result = {
              diceType: 20,
              rolls: [val],
              selectedRoll: val,
              modifier: rollModifier,
              total: val + rollModifier,
              mode: rollMode,
              label: 'd20',
            };
            setRollResult(result);
            setRollAnimationKey((k) => k + 1);
            addGameLog({ title: 'd20 gewürfelt', detail: `Ergebnis ${result.total}` });
          }}
        />
      </div>
    </div>
  );
}
