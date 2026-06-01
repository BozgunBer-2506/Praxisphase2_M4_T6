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

export type SaveGameState = {
  main_character: RuntimeCharacterState;
  npc_companion?: RuntimeCharacterState | null;
  story_flags: Record<string, boolean>;
  inventory: InventoryStateItem[];
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
