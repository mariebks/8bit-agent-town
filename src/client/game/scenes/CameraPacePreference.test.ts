import { describe, expect, test } from 'vitest';
import { loadCameraPace, storeCameraPace } from './CameraPacePreference';

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

describe('CameraPacePreference', () => {
  test('loads smooth by default and ignores invalid values', () => {
    expect(loadCameraPace(createStorage())).toBe('smooth');
    expect(loadCameraPace(createStorage({ 'agent-town.camera.pace': 'invalid' }))).toBe('smooth');
  });

  test('stores and reloads snappy pace', () => {
    const storage = createStorage();
    storeCameraPace('snappy', storage);
    expect(loadCameraPace(storage)).toBe('snappy');
  });
});
