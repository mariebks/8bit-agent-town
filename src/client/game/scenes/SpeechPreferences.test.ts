import { describe, expect, test } from 'vitest';
import { loadSelectedOnlySpeechEnabled, storeSelectedOnlySpeechEnabled } from './SpeechPreferences';

describe('SpeechPreferences', () => {
  test('loads and stores selected-only speech mode', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(loadSelectedOnlySpeechEnabled(adapter)).toBe(false);
    storeSelectedOnlySpeechEnabled(true, adapter);
    expect(loadSelectedOnlySpeechEnabled(adapter)).toBe(true);
    storeSelectedOnlySpeechEnabled(false, adapter);
    expect(loadSelectedOnlySpeechEnabled(adapter)).toBe(false);
  });

  test('handles null storage adapter safely', () => {
    expect(loadSelectedOnlySpeechEnabled(null)).toBe(false);
    expect(() => storeSelectedOnlySpeechEnabled(true, null)).not.toThrow();
  });
});
