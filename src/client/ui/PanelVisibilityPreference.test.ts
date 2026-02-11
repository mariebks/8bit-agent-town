import { describe, expect, test } from 'vitest';
import { loadPanelVisibilityMap, storePanelVisibilityMap } from './PanelVisibilityPreference';

function createStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe('PanelVisibilityPreference', () => {
  test('loads empty map for missing/invalid payloads', () => {
    expect(loadPanelVisibilityMap(createStorage())).toEqual({});
    expect(loadPanelVisibilityMap(createStorage({ 'agent-town.ui.panels.visible': '{"debug-panel":"yes"}' }))).toEqual({});
    expect(loadPanelVisibilityMap(createStorage({ 'agent-town.ui.panels.visible': '[]' }))).toEqual({});
  });

  test('stores and reloads boolean panel visibility flags', () => {
    const storage = createStorage();
    storePanelVisibilityMap(
      {
        'debug-panel': false,
        'timeline-panel': true,
      },
      storage,
    );

    expect(loadPanelVisibilityMap(storage)).toEqual({
      'debug-panel': false,
      'timeline-panel': true,
    });
  });
});
