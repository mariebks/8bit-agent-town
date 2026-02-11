export function pickFocusableInterestingAgent(
  nextInterestingAgentId: () => string | null,
  candidateCount: number,
  canFocus: (agentId: string) => boolean,
): string | null {
  if (candidateCount <= 0) {
    return null;
  }

  for (let attempt = 0; attempt < candidateCount; attempt += 1) {
    const candidate = nextInterestingAgentId();
    if (!candidate) {
      return null;
    }
    if (canFocus(candidate)) {
      return candidate;
    }
  }

  return null;
}

