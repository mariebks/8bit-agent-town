const SELECTED_AGENT_STORAGE_KEY = 'agent-town.selection.agent-id';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface ResolveSelectedAgentIdOptions {
  currentSelectedAgentId: string | null;
  preferredSelectedAgentId: string | null;
  activeAgentIds: ReadonlySet<string>;
  serverSelectionInitialized: boolean;
  manualSelectionMade: boolean;
  mostActiveAgentId: string | null;
  firstAgentId: string | null;
}

function isActive(agentId: string | null, activeAgentIds: ReadonlySet<string>): agentId is string {
  return typeof agentId === 'string' && activeAgentIds.has(agentId);
}

export function loadPreferredSelectedAgentId(storage: StorageLike | null): string | null {
  const value = storage?.getItem(SELECTED_AGENT_STORAGE_KEY);
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function storePreferredSelectedAgentId(agentId: string | null, storage: StorageLike | null): void {
  if (!storage) {
    return;
  }

  if (!agentId) {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(SELECTED_AGENT_STORAGE_KEY);
      return;
    }
    storage.setItem(SELECTED_AGENT_STORAGE_KEY, '');
    return;
  }

  storage.setItem(SELECTED_AGENT_STORAGE_KEY, agentId);
}

export function resolveSelectedAgentId(options: ResolveSelectedAgentIdOptions): string | null {
  if (isActive(options.currentSelectedAgentId, options.activeAgentIds)) {
    return options.currentSelectedAgentId;
  }

  if (isActive(options.preferredSelectedAgentId, options.activeAgentIds)) {
    return options.preferredSelectedAgentId;
  }

  if (options.serverSelectionInitialized) {
    return null;
  }

  if (options.manualSelectionMade) {
    return isActive(options.firstAgentId, options.activeAgentIds) ? options.firstAgentId : null;
  }

  if (isActive(options.mostActiveAgentId, options.activeAgentIds)) {
    return options.mostActiveAgentId;
  }

  return isActive(options.firstAgentId, options.activeAgentIds) ? options.firstAgentId : null;
}
