import { describe, expect, test } from 'vitest';
import {
  DEFAULT_UI_MODE,
  loadStoredUiMode,
  nextUiMode,
  parseUiMode,
  storeUiMode,
} from './UiMode';

describe('UiMode', () => {
  test('parses known modes and falls back for invalid values', () => {
    expect(parseUiMode('spectator')).toBe('spectator');
    expect(parseUiMode('cinematic')).toBe('spectator');
    expect(parseUiMode('story')).toBe('story');
    expect(parseUiMode('debug')).toBe('debug');
    expect(parseUiMode('invalid')).toBe(DEFAULT_UI_MODE);
    expect(parseUiMode(null)).toBe(DEFAULT_UI_MODE);
  });

  test('cycles through mode order', () => {
    expect(nextUiMode('spectator')).toBe('story');
    expect(nextUiMode('story')).toBe('debug');
    expect(nextUiMode('debug')).toBe('spectator');
  });

  test('loads and stores mode via storage adapter', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(loadStoredUiMode(adapter)).toBe(DEFAULT_UI_MODE);
    storeUiMode('story', adapter);
    expect(loadStoredUiMode(adapter)).toBe('story');

    storage.set('agent-town.ui.mode', 'oops');
    expect(loadStoredUiMode(adapter)).toBe(DEFAULT_UI_MODE);
  });
});
