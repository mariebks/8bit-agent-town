export type UiDensity = 'full' | 'compact';

export const UI_DENSITY_STORAGE_KEY = 'agent-town.ui.density';
export const DEFAULT_UI_DENSITY: UiDensity = 'full';

const VALID_UI_DENSITIES: UiDensity[] = ['full', 'compact'];

export function parseUiDensity(candidate: unknown, fallback: UiDensity = DEFAULT_UI_DENSITY): UiDensity {
  if (typeof candidate !== 'string') {
    return fallback;
  }

  if (candidate === 'dense') {
    return 'compact';
  }

  return VALID_UI_DENSITIES.includes(candidate as UiDensity) ? (candidate as UiDensity) : fallback;
}

export function nextUiDensity(density: UiDensity): UiDensity {
  return density === 'compact' ? 'full' : 'compact';
}

export function loadStoredUiDensity(storage: Pick<Storage, 'getItem'> | null | undefined): UiDensity {
  if (!storage) {
    return DEFAULT_UI_DENSITY;
  }

  try {
    return parseUiDensity(storage.getItem(UI_DENSITY_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_DENSITY;
  }
}

export function storeUiDensity(density: UiDensity, storage: Pick<Storage, 'setItem'> | null | undefined): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(UI_DENSITY_STORAGE_KEY, density);
  } catch {
    // Best effort only; ignore storage failures.
  }
}
