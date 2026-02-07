export type UiMode = 'spectator' | 'story' | 'debug';

export const UI_MODE_STORAGE_KEY = 'agent-town.ui.mode';
export const DEFAULT_UI_MODE: UiMode = 'spectator';

const VALID_UI_MODES: UiMode[] = ['spectator', 'story', 'debug'];

export function parseUiMode(candidate: unknown, fallback: UiMode = DEFAULT_UI_MODE): UiMode {
  if (typeof candidate !== 'string') {
    return fallback;
  }

  // Backward compatibility for older saved mode values.
  if (candidate === 'cinematic') {
    return 'spectator';
  }

  return VALID_UI_MODES.includes(candidate as UiMode) ? (candidate as UiMode) : fallback;
}

export function nextUiMode(mode: UiMode): UiMode {
  const index = VALID_UI_MODES.indexOf(mode);
  if (index < 0) {
    return DEFAULT_UI_MODE;
  }
  return VALID_UI_MODES[(index + 1) % VALID_UI_MODES.length];
}

export function loadStoredUiMode(storage: Pick<Storage, 'getItem'> | null | undefined): UiMode {
  if (!storage) {
    return DEFAULT_UI_MODE;
  }

  try {
    return parseUiMode(storage.getItem(UI_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_MODE;
  }
}

export function storeUiMode(mode: UiMode, storage: Pick<Storage, 'setItem'> | null | undefined): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(UI_MODE_STORAGE_KEY, mode);
  } catch {
    // Best effort only; ignore storage failures.
  }
}
