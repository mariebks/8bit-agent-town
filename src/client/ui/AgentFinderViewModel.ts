export interface AgentFinderHitView {
  id: string;
  name: string;
  occupation: string | null;
}

export function prioritizeRecentAgentFinderHits(
  hits: AgentFinderHitView[],
  recentAgentIds: readonly string[],
  max = hits.length,
): AgentFinderHitView[] {
  if (hits.length <= 1 || recentAgentIds.length === 0) {
    return hits.slice(0, max);
  }

  const rank = new Map<string, number>();
  for (let index = 0; index < recentAgentIds.length; index += 1) {
    rank.set(recentAgentIds[index], index);
  }

  const sorted = [...hits].sort((left, right) => {
    const leftRank = rank.get(left.id);
    const rightRank = rank.get(right.id);
    if (leftRank === undefined && rightRank === undefined) {
      return 0;
    }
    if (leftRank === undefined) {
      return 1;
    }
    if (rightRank === undefined) {
      return -1;
    }
    return leftRank - rightRank;
  });

  return sorted.slice(0, max);
}

export function areAgentFinderHitsEqual(left: AgentFinderHitView[], right: AgentFinderHitView[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a.id !== b.id || a.name !== b.name || a.occupation !== b.occupation) {
      return false;
    }
  }
  return true;
}
