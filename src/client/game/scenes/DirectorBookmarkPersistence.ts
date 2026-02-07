const DIRECTOR_BOOKMARKS_STORAGE_KEY = 'agent-town.director.bookmarks';
const MAX_BOOKMARKS = 10;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadDirectorBookmarkIds(storage: StorageLike | null): string[] {
  const raw = storage?.getItem(DIRECTOR_BOOKMARKS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const deduped: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') {
        continue;
      }
      const id = item.trim();
      if (id.length === 0 || deduped.includes(id)) {
        continue;
      }
      deduped.push(id);
      if (deduped.length >= MAX_BOOKMARKS) {
        break;
      }
    }
    return deduped;
  } catch {
    return [];
  }
}

export function storeDirectorBookmarkIds(agentIds: string[], storage: StorageLike | null): void {
  if (!storage) {
    return;
  }

  const sanitized: string[] = [];
  for (const id of agentIds) {
    const normalized = id.trim();
    if (normalized.length === 0 || sanitized.includes(normalized)) {
      continue;
    }
    sanitized.push(normalized);
    if (sanitized.length >= MAX_BOOKMARKS) {
      break;
    }
  }

  storage.setItem(DIRECTOR_BOOKMARKS_STORAGE_KEY, JSON.stringify(sanitized));
}
