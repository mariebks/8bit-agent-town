import { describe, expect, test } from 'vitest';
import { applyFocusUiDataset, loadFocusUiEnabled, storeFocusUiEnabled } from './FocusUi';

describe('FocusUi', () => {
  test('loads and stores focus mode through storage adapter', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(loadFocusUiEnabled(adapter)).toBe(false);
    storeFocusUiEnabled(true, adapter);
    expect(loadFocusUiEnabled(adapter)).toBe(true);
    storeFocusUiEnabled(false, adapter);
    expect(loadFocusUiEnabled(adapter)).toBe(false);
  });

  test('applies focus mode state to body dataset', () => {
    const dataset: { focusUi?: string } = {};
    applyFocusUiDataset(true, dataset);
    expect(dataset.focusUi).toBe('on');
    applyFocusUiDataset(false, dataset);
    expect(dataset.focusUi).toBe('off');
  });
});
