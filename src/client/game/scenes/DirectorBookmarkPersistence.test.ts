import { describe, expect, test } from 'vitest';
import { loadDirectorBookmarkIds, storeDirectorBookmarkIds } from './DirectorBookmarkPersistence';

describe('DirectorBookmarkPersistence', () => {
  test('loads bookmark ids and ignores invalid values', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    storage.set('agent-town.director.bookmarks', JSON.stringify(['a1', 'a2', 'a1', '   ', 4]));
    expect(loadDirectorBookmarkIds(adapter)).toEqual(['a1', 'a2']);
  });

  test('stores a sanitized capped bookmark list', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    storeDirectorBookmarkIds(['a1', 'a2', 'a1', '', 'a3'], adapter);
    expect(storage.get('agent-town.director.bookmarks')).toBe(JSON.stringify(['a1', 'a2', 'a3']));
  });
});
