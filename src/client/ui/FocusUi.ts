const FOCUS_UI_STORAGE_KEY = 'agent-town.ui.focus';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DatasetLike {
  focusUi?: string;
}

export function loadFocusUiEnabled(storage: StorageLike | null): boolean {
  return storage?.getItem(FOCUS_UI_STORAGE_KEY) === '1';
}

export function storeFocusUiEnabled(enabled: boolean, storage: StorageLike | null): void {
  storage?.setItem(FOCUS_UI_STORAGE_KEY, enabled ? '1' : '0');
}

export function applyFocusUiDataset(enabled: boolean, dataset: DatasetLike | undefined): void {
  if (!dataset) {
    return;
  }
  dataset.focusUi = enabled ? 'on' : 'off';
}
