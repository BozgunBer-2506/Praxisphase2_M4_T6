import type {
  FrontendEncounterState,
  HudEvent,
  SaveEncounterResolveResponse,
} from "./backendApi";

export type InitiativeActor = {
  id: string;
  name: string;
  kind: "player" | "companion" | "enemy";
  total?: number;
};

export type EnemyCombatState = {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  speed: number;
  conditions: string[];
};

export type CombatRoundState = {
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

export type CombatAttackStep =
  | "idle"
  | "chooseAction"
  | "chooseTarget"
  | "awaitAttackRoll"
  | "awaitDamageRoll"
  | "turnResolved"
  | "enemyResolving";

export type CombatAttackFlowState = {
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

export type CombatLogEntry = {
  id: string;
  title: string;
  detail: string;
  total?: number;
};

export type CombatRouteStateSnapshot = {
  roundState: CombatRoundState;
  attackFlowState: CombatAttackFlowState;
  selectedTargetId: string | null;
  status: string;
  logEntries: CombatLogEntry[];
};

export type CombatTurnAdvanceResult = {
  roundState: CombatRoundState;
  attackFlowState: CombatAttackFlowState;
  isNewRound: boolean;
};

export type LegacySaveEncounterResolveResponse = Omit<
  SaveEncounterResolveResponse,
  "frontend_state"
> & {
  frontend_state?: FrontendEncounterState;
};

export const COMBAT_ROUTE_STATE_KEY = "falkenwacht.combatRouteState";

export const combatFlowStepCopy: Record<CombatAttackStep, string> = {
  idle: "Warte auf Kampfrunde.",
  chooseAction: "Waehle eine Waffe oder einen Spell.",
  chooseTarget: "Waehle ein Ziel fuer diese Aktion.",
  awaitAttackRoll:
    "Angriffswurf erforderlich. Der Zug pausiert bis zum Hit Roll.",
  awaitDamageRoll: "Treffer. Schadenwurf erforderlich, bevor der Zug endet.",
  turnResolved: "Aktion ausgewertet. Der Zug kann beendet werden.",
  enemyResolving: "DM-KI fuehrt den Gegnerzug verdeckt aus.",
};

export const getCombatActorDisplayName = (
  actorId: string | null | undefined,
  initiativeOrder: InitiativeActor[],
  resolveCharacterName?: (actorId: string) => string | null,
) => {
  if (!actorId) {
    return "Unbekannt";
  }

  const initiativeActor = initiativeOrder.find((actor) => actor.id === actorId);
  const characterName = resolveCharacterName?.(actorId);

  if (initiativeActor) {
    return initiativeActor.name;
  }

  if (characterName) {
    return characterName;
  }

  return actorId;
};

export const createInitialCombatEnemies = (): EnemyCombatState[] => [
  {
    id: "shadow-raider-1",
    name: "Schattenraeuber A",
    currentHp: 16,
    maxHp: 16,
    ac: 14,
    speed: 30,
    conditions: [],
  },
  {
    id: "shadow-raider-2",
    name: "Schattenraeuber B",
    currentHp: 16,
    maxHp: 16,
    ac: 14,
    speed: 30,
    conditions: [],
  },
  {
    id: "shadow-raider-3",
    name: "Schattenraeuber C",
    currentHp: 16,
    maxHp: 16,
    ac: 14,
    speed: 30,
    conditions: [],
  },
];

export const createInitialCombatRoundState = (): CombatRoundState => ({
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

export const createInitialCombatAttackFlowState = (): CombatAttackFlowState => ({
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

export const createCombatAttackFlowStateForActor = (
  actor: InitiativeActor | undefined,
  round: number,
): CombatAttackFlowState => ({
  ...createInitialCombatAttackFlowState(),
  actorId: actor?.id ?? null,
  step:
    round <= 0
      ? "idle"
      : actor?.kind === "enemy"
        ? "enemyResolving"
        : "chooseAction",
});

export const advanceCombatTurnState = (
  currentState: CombatRoundState,
): CombatTurnAdvanceResult | null => {
  const order = currentState.initiativeOrder;

  if (order.length === 0 || currentState.round === 0) {
    return null;
  }

  const nextTurnIndex = (currentState.turnIndex + 1) % order.length;
  const isNewRound = nextTurnIndex === 0;
  const nextRound = isNewRound ? currentState.round + 1 : currentState.round;
  const nextActor = order[nextTurnIndex];

  return {
    roundState: {
      ...currentState,
      round: nextRound,
      activeActorId: nextActor?.id ?? null,
      turnIndex: nextTurnIndex,
      awaitingRoll: null,
    },
    attackFlowState: createCombatAttackFlowStateForActor(nextActor, nextRound),
    isNewRound,
  };
};

export const writeCombatRouteStateSnapshot = (
  snapshot: CombatRouteStateSnapshot,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COMBAT_ROUTE_STATE_KEY,
    JSON.stringify(snapshot),
  );
};

export const readCombatRouteStateSnapshot = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedSnapshot = window.localStorage.getItem(COMBAT_ROUTE_STATE_KEY);

    return storedSnapshot
      ? (JSON.parse(storedSnapshot) as CombatRouteStateSnapshot)
      : null;
  } catch {
    return null;
  }
};
