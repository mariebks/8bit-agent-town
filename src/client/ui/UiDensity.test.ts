import { describe, expect, test } from 'vitest';
import {
  DEFAULT_UI_DENSITY,
  loadStoredUiDensity,
  nextUiDensity,
  parseUiDensity,
  storeUiDensity,
} from './UiDensity';

describe('UiDensity', () => {
  test('parses known values and preserves backward compatibility', () => {
    expect(parseUiDensity('full')).toBe('full');
    expect(parseUiDensity('compact')).toBe('compact');
    expect(parseUiDensity('dense')).toBe('compact');
    expect(parseUiDensity('other')).toBe(DEFAULT_UI_DENSITY);
    expect(parseUiDensity(null)).toBe(DEFAULT_UI_DENSITY);
  });

  test('cycles between full and compact', () => {
    expect(nextUiDensity('full')).toBe('compact');
    expect(nextUiDensity('compact')).toBe('full');
  });

  test('loads and stores density via storage adapter', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(loadStoredUiDensity(adapter)).toBe(DEFAULT_UI_DENSITY);
    storeUiDensity('compact', adapter);
    expect(loadStoredUiDensity(adapter)).toBe('compact');

    storage.set('agent-town.ui.density', 'invalid');
    expect(loadStoredUiDensity(adapter)).toBe(DEFAULT_UI_DENSITY);
  });
});
