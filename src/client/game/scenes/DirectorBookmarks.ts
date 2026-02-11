export interface DirectorBookmarkState {
  bookmarkAgentIds: string[];
  nextIndex: number;
}

export function addDirectorBookmark(
  state: DirectorBookmarkState,
  agentId: string,
  maxBookmarks = 10,
): DirectorBookmarkState {
  const deduped = state.bookmarkAgentIds.filter((id) => id !== agentId);
  deduped.push(agentId);
  const trimmed = deduped.slice(Math.max(0, deduped.length - maxBookmarks));
  return {
    bookmarkAgentIds: trimmed,
    nextIndex: Math.min(state.nextIndex, Math.max(0, trimmed.length - 1)),
  };
}

export function nextDirectorBookmark(state: DirectorBookmarkState): { agentId: string | null; state: DirectorBookmarkState } {
  if (state.bookmarkAgentIds.length === 0) {
    return {
      agentId: null,
      state,
    };
  }

  const index = state.nextIndex % state.bookmarkAgentIds.length;
  const agentId = state.bookmarkAgentIds[index];
  return {
    agentId,
    state: {
      bookmarkAgentIds: state.bookmarkAgentIds,
      nextIndex: (index + 1) % state.bookmarkAgentIds.length,
    },
  };
}

export function pruneDirectorBookmarks(state: DirectorBookmarkState, activeAgentIds: ReadonlySet<string>): DirectorBookmarkState {
  const nextBookmarks = state.bookmarkAgentIds.filter((agentId) => activeAgentIds.has(agentId));
  if (nextBookmarks.length === state.bookmarkAgentIds.length) {
    return state;
  }

  return {
    bookmarkAgentIds: nextBookmarks,
    nextIndex: nextBookmarks.length === 0 ? 0 : state.nextIndex % nextBookmarks.length,
  };
}
