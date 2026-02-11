import { describe, expect, test } from 'vitest';
import { loadTimelineFilter, storeTimelineFilter } from './TimelineFilterPreference';

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

describe('TimelineFilterPreference', () => {
  test('loads all as default when value is missing or invalid', () => {
    const emptyStorage = createStorage();
    const invalidStorage = createStorage({ 'agent-town.timeline.filter': 'noise' });

    expect(loadTimelineFilter(emptyStorage)).toBe('all');
    expect(loadTimelineFilter(invalidStorage)).toBe('all');
  });

  test('stores and reloads valid timeline filters', () => {
    const storage = createStorage();
    storeTimelineFilter('planning', storage);

    expect(loadTimelineFilter(storage)).toBe('planning');
  });
});
