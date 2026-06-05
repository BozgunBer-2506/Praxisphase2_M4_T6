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

export type LegacySaveEncounterResolveResponse = Omit<
  SaveEncounterResolveResponse,
  "frontend_state"
> & {
  frontend_state?: FrontendEncounterState;
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
