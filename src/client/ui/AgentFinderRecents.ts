const RECENT_AGENT_IDS_KEY = 'agent-town.finder.recent-agent-ids';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadRecentAgentIds(storage: StorageLike | null, max = 5): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(RECENT_AGENT_IDS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const ids = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
    return ids.slice(0, max);
  } catch {
    return [];
  }
}

export function storeRecentAgentIds(ids: string[], storage: StorageLike | null, max = 5): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(RECENT_AGENT_IDS_KEY, JSON.stringify(ids.slice(0, max)));
  } catch {
    // Best effort.
  }
}

export function pushRecentAgentId(current: readonly string[], agentId: string, max = 5): string[] {
  const filtered = current.filter((id) => id !== agentId);
  return [agentId, ...filtered].slice(0, max);
}
