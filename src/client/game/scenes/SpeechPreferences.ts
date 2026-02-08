const SELECTED_ONLY_SPEECH_STORAGE_KEY = 'agent-town.speech.selected-only';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSelectedOnlySpeechEnabled(storage: StorageLike | null): boolean {
  return storage?.getItem(SELECTED_ONLY_SPEECH_STORAGE_KEY) === '1';
}

export function storeSelectedOnlySpeechEnabled(enabled: boolean, storage: StorageLike | null): void {
  storage?.setItem(SELECTED_ONLY_SPEECH_STORAGE_KEY, enabled ? '1' : '0');
}
