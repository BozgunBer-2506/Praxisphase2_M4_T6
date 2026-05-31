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

const SAVE_KEY = "falkenwacht.saveStates";
const LAST_SAVE_KEY = "falkenwacht.lastSave";
const MAX_ACCOUNT_SAVES = 15;
const MAX_CAMPAIGN_SAVES = 5;
const CAMPAIGN_TITLE = "Falkenwacht - Die Korruption der Greifenstadt";
const WORD_REVEAL_MS = 85;
const diceTypes = [4, 6, 8, 10, 12, 20, 100] as const;

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
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null);
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

    if (sceneParam && scenes.some((scene) => scene.id === sceneParam)) {
      setCurrentSceneId(sceneParam);
    }

    if (
      characterParam &&
      (characterParam === "ryu" || characterParam === "ayane")
    ) {
      setSelectedCharacterId(characterParam);
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
  const actorName = activeCharacter?.name ?? "Der Charakter";
  const pendingSkillNames = new Set(
    pendingCheck?.checks
      .map((check) => check.skill)
      .filter((skill): skill is string => Boolean(skill)) ?? [],
  );

  const addGameLog = (entry: Omit<GameLogEntry, "id" | "createdAt">) => {
    setGameLog((items) => [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...entry,
      },
      ...items,
    ].slice(0, 20));
  };

  const getChoiceChecks = (choice: Choice) =>
    choice.check ? [choice.check] : choice.checks ?? [];

  const formatChecks = (checks: SkillCheck[]) =>
    checks
      .map((check) => `${check.skill ?? check.ability} DC ${check.dc}`)
      .join(" oder ");

  const formatChoiceDescription = (choice: Choice) => {
    const checks = getChoiceChecks(choice);
    const personalized = choice.description
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

    return checks.length > 0
      ? `${personalized} (${formatChecks(checks)})`
      : personalized;
  };

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
      id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
    options?: { skill?: string },
  ) => {
    const normalizedFormula = formula.replace(/\s/g, "");
    const match = normalizedFormula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);

    if (!match) {
      return;
    }

    const diceCount = Number(match[1] || "1");
    const formulaDiceType = Number(match[2]);
    const modifier = Number(match[3] || "0");
    const rolls = Array.from({ length: diceCount }, () =>
      Math.floor(Math.random() * formulaDiceType) + 1,
    );
    const selectedRoll = rolls.reduce((sum, roll) => sum + roll, 0);
    const result = {
      diceType: formulaDiceType,
      rolls,
      selectedRoll,
      modifier,
      total: selectedRoll + modifier,
      mode: "normal" as RollMode,
      label,
    };

    setRollResult(result);
    setRollAnimationKey((currentKey) => currentKey + 1);
    addGameLog({
      title: label,
      detail: `Wurf ${rolls.join(" + ")} + Mod ${modifier} · Ergebnis ${result.total}`,
      total: result.total,
    });

    if (!pendingCheck || !options?.skill) {
      return;
    }

    const matchingCheck = pendingCheck.checks.find(
      (check) => check.skill === options.skill,
    );

    if (!matchingCheck) {
      return;
    }

    const naturalRoll = rolls[0];
    const success = naturalRoll === 20 || result.total >= matchingCheck.dc;
    const targetSceneId =
      naturalRoll === 20
        ? pendingCheck.choice.natural20SceneId ?? pendingCheck.choice.nextSceneId
        : naturalRoll === 1
          ? pendingCheck.choice.natural1SceneId ??
            pendingCheck.choice.failureSceneId ??
            pendingCheck.choice.nextSceneId
          : success
            ? pendingCheck.choice.nextSceneId
            : pendingCheck.choice.failureSceneId ?? pendingCheck.choice.nextSceneId;
    const checkDetail =
      naturalRoll === 20
        ? `Natural 20: ${options.skill} gegen DC ${matchingCheck.dc} automatisch stark geschafft.`
        : naturalRoll === 1
          ? `Natural 1: ${options.skill} gegen DC ${matchingCheck.dc} kritisch verfehlt.`
          : `${options.skill} ${result.total} gegen DC ${matchingCheck.dc}: ${
              success ? "geschafft" : "nicht geschafft"
            }.`;

    addGameLog({
      title: "Skillcheck ausgewertet",
      detail: checkDetail,
      total: result.total,
    });
    setDmMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        sender: "DM",
        text: checkDetail,
      },
    ]);
    setPendingCheck(null);

    window.setTimeout(() => {
      if (selectedCharacterId) {
        persistSaveState(targetSceneId, selectedCharacterId, pendingCheck.choice.label);
      }

      goToScene(targetSceneId);
    }, 900);
  };

  const sendDmMessage = () => {
    const trimmedInput = dmInput.trim();

    if (!trimmedInput) {
      return;
    }

    setDmMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        sender: "Spieler",
        text: trimmedInput,
      },
      {
        id: crypto.randomUUID(),
        sender: "DM",
        text: "Notiert. Im nächsten Backend-Schritt wird diese Frage an die AI-DM-Logik weitergegeben. Aktuell ist dies ein Frontend-Platzhalter.",
      },
    ]);
    setDmInput("");
  };

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
    <main className="h-screen overflow-hidden px-4 py-3 text-slate-50 sm:px-6 lg:px-8">
      <section className="mx-auto flex h-full max-w-6xl flex-col gap-3">
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

        <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
          <BookOpen className="mb-1 size-4 text-ember-400" />
          <p className="text-xs text-slate-400">Aktuelle Szene</p>
          <p className="text-sm font-semibold">
            {currentScene.chapter} · {currentScene.title}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] gap-3">
          <aside className="relative z-30 min-h-0 overflow-y-auto rounded-md border border-white/10 bg-ink-950/70 p-3">
            <button
              className="mb-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-left"
              onClick={() => setIsSheetExpanded((isExpanded) => !isExpanded)}
              type="button"
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.16em] text-ember-300">
                  Charakterbogen
                </span>
                <span className="block text-sm font-bold">
                  {activeCharacter?.name ?? "Noch kein Charakter"}
                </span>
              </span>
              <ChevronDown
                className={`size-4 transition ${
                  isSheetExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {activeCharacter && activeSheet && isSheetExpanded ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-md border border-white/10 bg-black/35">
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                    <HeartPulse className="mb-1 size-4 text-ember-400" />
                    <p className="text-xs text-slate-400">HP</p>
                    <p className="text-sm font-bold">
                      {activeCharacter.stats.hp} / {activeCharacter.stats.hp}
                    </p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
                    <ShieldCheck className="mb-1 size-4 text-ember-400" />
                    <p className="text-xs text-slate-400">AC</p>
                    <p className="text-sm font-bold">
                      {activeCharacter.stats.ac}
                    </p>
                  </div>
                </div>

                <button
                  className="w-full rounded-md border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-left transition hover:border-ember-400"
                  onClick={() =>
                    rollFormula(
                      `${activeCharacter.name} Initiative`,
                      `1d20+${activeCharacter.stats.initiative}`,
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

        <section className="flex min-h-0 flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/70 shadow-2xl">
          <div
            className="relative flex aspect-video max-h-[calc(100vh-21rem)] min-h-0 flex-none items-end bg-cover bg-center p-4 lg:p-5"
            style={{
              backgroundImage: `linear-gradient(180deg,rgba(17,24,39,0.22),rgba(3,4,10,0.94)),url('${currentScene.imageUrl}')`,
            }}
          >
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
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 border-t border-white/10 p-3">
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
              </aside>
            ) : null}

            {pendingCheck ? (
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

            {isCharacterSelection ? (
              <div className="grid w-full gap-4 lg:grid-cols-2">
                {(["ryu", "ayane"] as CharacterId[]).map((characterId) => {
                  const character = characters[characterId];

                  return (
                    <button
                      className="group flex min-h-[32rem] flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/75 text-left transition hover:border-ember-400/70 hover:bg-ink-950/90"
                      key={character.id}
                      onClick={() => selectCharacter(character.id)}
                      type="button"
                    >
                      <div className="flex min-h-64 items-end justify-center bg-gradient-to-b from-white/5 to-transparent px-3 pt-3">
                        <Image
                          alt={`${character.name} Charaktermodell`}
                          className="max-h-72 object-contain drop-shadow-2xl transition group-hover:scale-[1.03]"
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
                          Initiative +{character.stats.initiative}
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
            <div className="min-h-20 space-y-2 overflow-y-auto border-t border-white/10 bg-ink-950/95 p-2">
              {pendingCheck ? (
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
              {isLastDialogueLine && isDialogueFullyVisible
                ? currentScene.choices.map((choice) => (
                    <button
                      className="w-full rounded-md border border-white/10 bg-white/[0.06] px-3 py-3 text-left text-sm text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                      key={choice.id}
                      onClick={() => chooseAction(choice)}
                      type="button"
                    >
                      <span className="block font-semibold">
                        {choice.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                        {formatChoiceDescription(choice)}
                      </span>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
        </section>
        </div>
      </section>
      <aside
        className={`fixed bottom-3 right-2 z-[80] max-w-[calc(100vw-1rem)] rounded-md border border-ember-400/40 bg-ink-950/95 p-2 text-slate-50 shadow-2xl transition-all ${
          isDicePanelOpen ? "w-40" : "w-20"
        }`}
      >
        <button
          aria-label={
            isDicePanelOpen ? "Würfel-HUD einklappen" : "Würfel-HUD ausklappen"
          }
          className="relative mx-auto grid size-16 place-items-center"
          onClick={() => setIsDicePanelOpen((isOpen) => !isOpen)}
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
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-white/15 bg-ink-950/95 text-white">
            {isDicePanelOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </span>
        </button>
        <div className="hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ember-300">
              Würfel
            </p>
            <p className="text-sm font-bold leading-tight">
              {rollResult?.label ?? "Bereit"}
            </p>
          </div>
          <div
            className={`grid size-14 shrink-0 place-items-center rounded-lg border bg-gradient-to-br text-xl font-black shadow-glow ${diceColorClass[diceColor]}`}
          >
            {rollResult?.total ?? "d20"}
          </div>
        </div>

        {isDicePanelOpen ? (
          <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
          <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Palette className="size-3" />
            Farbe
          </span>
          <div className="flex gap-1">
            {(["ember", "arcane", "venom", "blood"] as DiceColor[]).map(
              (color) => (
                <button
                  aria-label={`Würfelfarbe ${color}`}
                  className={`size-4 rounded-full border transition ${
                    diceColor === color
                      ? "border-white ring-2 ring-white/20"
                      : "border-white/20 hover:border-white/60"
                  } ${diceColorDotClass[color]}`}
                  key={color}
                  onClick={() => setDiceColor(color)}
                  type="button"
                />
              ),
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          {diceTypes.map((item) => (
            <button
              className={`rounded-md border px-2 py-1.5 text-xs font-bold transition ${
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

        <div className="mt-2 grid grid-cols-1 gap-1">
          {(["normal", "advantage", "disadvantage"] as RollMode[]).map(
            (mode) => (
              <button
                className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
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

        <div className="mt-2 grid gap-2">
          <input
            aria-label="Würfelmodifikator"
            className="h-9 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-100 outline-none"
            onChange={(event) => setRollModifier(Number(event.target.value) || 0)}
            type="number"
            value={rollModifier}
          />
          <button
            className="h-9 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
            onClick={rollManualDice}
            type="button"
          >
            Würfeln
          </button>
        </div>

        {rollResult ? (
          <p className="text-xs text-slate-400">
            {rollResult.rolls.join(" / ")} + Mod {rollResult.modifier}
          </p>
        ) : null}
          </div>
        ) : null}
      </aside>
    </main>
  );
}
