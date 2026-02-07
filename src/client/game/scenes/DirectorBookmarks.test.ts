import { describe, expect, test } from 'vitest';
import { addDirectorBookmark, nextDirectorBookmark } from './DirectorBookmarks';

describe('DirectorBookmarks', () => {
  test('adds bookmarks with dedupe and max cap', () => {
    const afterFirst = addDirectorBookmark({ bookmarkAgentIds: ['a1', 'a2'], nextIndex: 0 }, 'a1', 2);
    expect(afterFirst.bookmarkAgentIds).toEqual(['a2', 'a1']);

    const afterCap = addDirectorBookmark(afterFirst, 'a3', 2);
    expect(afterCap.bookmarkAgentIds).toEqual(['a1', 'a3']);
  });

  test('cycles through bookmarks in order', () => {
    let state = { bookmarkAgentIds: ['a1', 'a2', 'a3'], nextIndex: 0 };
    const first = nextDirectorBookmark(state);
    expect(first.agentId).toBe('a1');
    state = first.state;
    const second = nextDirectorBookmark(state);
    expect(second.agentId).toBe('a2');
    const third = nextDirectorBookmark(second.state);
    expect(third.agentId).toBe('a3');
    const fourth = nextDirectorBookmark(third.state);
    expect(fourth.agentId).toBe('a1');
  });
});
