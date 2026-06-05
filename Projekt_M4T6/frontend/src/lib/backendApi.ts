const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

export type InventoryAction = "use" | "equip" | "unequip" | "drop";

export type InventoryStateItem = {
  item_id: string;
  name: string;
  quantity: number;
  equipped?: boolean;
};

export type InventoryViewItem = InventoryStateItem & {
  category?: string;
  description?: string;
  actions?: InventoryAction[];
  equipment_slot?: string;
  effect?: Record<string, unknown>;
};

export type RuntimeCharacterState = {
  character_id: string;
  current_hp: number;
  max_hp: number;
  conditions?: string[];
};

export type EncounterInitiativeEntry = {
  participant_id: string;
  roll: number;
  modifier: number;
  total: number;
  nat20: boolean;
  nat1: boolean;
};

export type EncounterParticipantState = {
  participant_id: string;
  side: "heroes" | "enemies";
  current_hp: number;
  max_hp: number;
  defeated: boolean;
  armor_class?: number;
  speed?: number;
};

export type EncounterState = {
  round_number: number;
  turn_index: number;
  active_participant_id: string;
  initiative_order: EncounterInitiativeEntry[];
  participants: EncounterParticipantState[];
  combat_finished: boolean;
};

export type SaveGameState = {
  main_character: RuntimeCharacterState;
  npc_companion?: RuntimeCharacterState | null;
  story_flags: Record<string, boolean>;
  inventory: InventoryStateItem[];
  encounter?: EncounterState | null;
};

export type HudEvent = {
  type: string;
  label?: string;
  payload?: Record<string, unknown>;
  item_id?: string;
  equipment_slot?: string;
};

export type AiDmNarrationResponse = {
  narration: string;
  visible_rules_result: Record<string, unknown>;
  hud_events: HudEvent[];
  state_locked: boolean;
};

export type AiDmHelpRequest = {
  message: string;
  slot_name?: string;
  scene_context?: Record<string, unknown>;
  rules_result?: Record<string, unknown>;
  character_state?: Record<string, unknown>;
  inventory?: InventoryStateItem[];
};

export type AiDmHelpResponse = {
  command: string;
  answer: string;
  topics: string[];
  state_locked: boolean;
  allowed_scope: string[];
};

export type CombatResolveRequest = {
  character_id: string;
  attack_modifier: number;
  target_ac: number;
  damage_dice_count: number;
  damage_die_sides: number;
  damage_modifier?: number;
  target_current_hp: number;
};

export type CombatResolveResponse = {
  attack: {
    roll: number;
    modifier: number;
    total: number;
    nat20: boolean;
    nat1: boolean;
    target_ac: number;
    hit: boolean;
    critical: boolean;
  };
  damage: {
    dice_count: number;
    die_sides: number;
    modifier: number;
    critical: boolean;
    rolls: number[];
    total: number;
  };
  hp: {
    previous_hp: number;
    damage: number;
    remaining_hp: number;
    defeated: boolean;
  };
};

export type EncounterAutoTurnAction = {
  action_type: "attack";
  actor_id: string;
  target_id: string;
};

export type FrontendEncounterActor = {
  id: string;
  participantId: string;
  name: string;
  kind: "player" | "enemy" | "unknown";
  side?: "heroes" | "enemies" | string | null;
  currentHp?: number | null;
  maxHp?: number | null;
  ac?: number | null;
  speed?: number | null;
  defeated?: boolean;
  total?: number | null;
  roll?: number | null;
  modifier?: number | null;
  nat20?: boolean;
  nat1?: boolean;
};

export type FrontendEncounterTurnControl = {
  requiresPlayerAction: boolean;
  requiresDamageRoll?: boolean;
  autoResolvable: boolean;
  allowedActions: string[];
  availableTargets: FrontendEncounterActor[];
};

export type FrontendEncounterPendingDamage = {
  actorId?: string | null;
  actor_id?: string | null;
  targetId?: string | null;
  target_id?: string | null;
  damageDiceCount?: number | null;
  damage_dice_count?: number | null;
  damageDieSides?: number | null;
  damage_die_sides?: number | null;
  damageModifier?: number | null;
  damage_modifier?: number | null;
  critical?: boolean;
};

export type FrontendEncounterResolution = {
  actorId?: string | null;
  targetId?: string | null;
  combatFinished?: boolean;
  attack: {
    roll?: number | null;
    modifier?: number | null;
    total?: number | null;
    targetAc?: number | null;
    hit?: boolean;
    critical?: boolean;
    nat20?: boolean;
    nat1?: boolean;
  } | null;
  damage: {
    rolls?: number[];
    modifier?: number | null;
    total?: number | null;
    critical?: boolean;
  } | null;
  hp: {
    previousHp?: number | null;
    damage?: number | null;
    remainingHp?: number | null;
    defeated?: boolean;
  } | null;
};

export type FrontendEncounterState = {
  round: number;
  turnIndex: number;
  activeActorId: string | null;
  activeActor: FrontendEncounterActor | null;
  initiativeOrder: FrontendEncounterActor[];
  participants: FrontendEncounterActor[];
  heroes: FrontendEncounterActor[];
  enemies: FrontendEncounterActor[];
  combatFinished: boolean;
  turnControl: FrontendEncounterTurnControl;
  hudEvents: HudEvent[];
  lastBackendEvents: HudEvent[];
  lastResolution: FrontendEncounterResolution | null;
  pendingDamage?: FrontendEncounterPendingDamage | null;
};

export type SaveEncounterResolveResponse = {
  slot_name: string;
  state: SaveGameState & { encounter?: Record<string, unknown> };
  rules_result: Record<string, unknown>;
  hud_events: HudEvent[];
  turn_events: HudEvent[];
  frontend_state: FrontendEncounterState;
};

export type SaveEncounterAutoTurnResolveResponse = SaveEncounterResolveResponse;
export type SaveEncounterAttackRollResolveResponse = SaveEncounterResolveResponse;
export type SaveEncounterDamageRollResolveResponse = SaveEncounterResolveResponse;

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers:
      options.body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Backend ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

export async function getInventoryView(inventory: InventoryStateItem[]) {
  return request<{ items: InventoryViewItem[] }>("/inventory/view", {
    method: "POST",
    body: { inventory },
  });
}

export async function createOrUpdateSave(payload: {
  slot_name: string;
  character_id: string;
  scene_number: number;
  state: SaveGameState;
}) {
  return request("/saves", {
    method: "POST",
    body: payload,
  });
}

export async function runSaveInventoryAction(
  slotName: string,
  itemId: string,
  action: InventoryAction,
) {
  return request<{
    slot_name: string;
    state: SaveGameState;
    inventory: InventoryViewItem[];
    events: HudEvent[];
  }>(`/saves/${encodeURIComponent(slotName)}/inventory/action`, {
    method: "POST",
    body: {
      item_id: itemId,
      action,
    },
  });
}

export async function narrateWithAiDm(payload: {
  scene_title: string;
  player_choice: string;
  rules_result: Record<string, unknown>;
  character_state: Record<string, unknown>;
  enemies?: Record<string, unknown>[];
  inventory?: InventoryStateItem[];
}) {
  return request<AiDmNarrationResponse>("/ai-dm/narrate", {
    method: "POST",
    body: {
      enemies: [],
      inventory: [],
      ...payload,
    },
  });
}

export async function askAiDmHelp(payload: AiDmHelpRequest) {
  return request<AiDmHelpResponse>("/ai-dm/help", {
    method: "POST",
    body: {
      scene_context: {},
      rules_result: {},
      character_state: {},
      inventory: [],
      ...payload,
    },
  });
}

export async function resolveCombat(payload: CombatResolveRequest) {
  return request<CombatResolveResponse>("/combat/resolve", {
    method: "POST",
    body: payload,
  });
}

export async function resolveSaveEncounterAutoTurn(
  slotName: string,
  action?: EncounterAutoTurnAction,
) {
  return request<SaveEncounterAutoTurnResolveResponse>(
    `/saves/${encodeURIComponent(slotName)}/encounter/auto-turn/resolve`,
    {
      method: "POST",
      body: action ? { action } : {},
    },
  );
}

export async function resolveSaveEncounterAttackRoll(
  slotName: string,
  action: EncounterAutoTurnAction,
) {
  return request<SaveEncounterAttackRollResolveResponse>(
    `/saves/${encodeURIComponent(slotName)}/encounter/attack-roll/resolve`,
    {
      method: "POST",
      body: { action },
    },
  );
}

export async function resolveSaveEncounterDamageRoll(slotName: string) {
  return request<SaveEncounterDamageRollResolveResponse>(
    `/saves/${encodeURIComponent(slotName)}/encounter/damage-roll/resolve`,
    {
      method: "POST",
      body: {},
    },
  );
}
