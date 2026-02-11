const PANEL_VISIBILITY_STORAGE_KEY = 'agent-town.ui.panels.visible';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadPanelVisibilityMap(storage: StorageLike | null): Record<string, boolean> {
  const raw = storage?.getItem(PANEL_VISIBILITY_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = key.trim();
      if (id.length === 0 || typeof value !== 'boolean') {
        continue;
      }
      normalized[id] = value;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function storePanelVisibilityMap(visibility: Record<string, boolean>, storage: StorageLike | null): void {
  if (!storage) {
    return;
  }

  const normalized: Record<string, boolean> = {};
  for (const [id, visible] of Object.entries(visibility)) {
    const normalizedId = id.trim();
    if (normalizedId.length === 0 || typeof visible !== 'boolean') {
      continue;
    }
    normalized[normalizedId] = visible;
  }

  storage.setItem(PANEL_VISIBILITY_STORAGE_KEY, JSON.stringify(normalized));
}
