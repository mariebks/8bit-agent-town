interface FinderStatusOverride {
  message: string;
  expiresAtMs: number;
}

export function defaultAgentFinderStatus(matchCount: number): string {
  return matchCount > 0 ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : 'type to search';
}

export function resolveAgentFinderStatus(
  matchCount: number,
  override: FinderStatusOverride | null,
  nowMs: number,
): { message: string; nextOverride: FinderStatusOverride | null } {
  if (override && nowMs < override.expiresAtMs) {
    return { message: override.message, nextOverride: override };
  }
  return {
    message: defaultAgentFinderStatus(matchCount),
    nextOverride: null,
  };
}
