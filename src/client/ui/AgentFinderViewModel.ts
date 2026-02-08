export interface AgentFinderHitView {
  id: string;
  name: string;
  occupation: string | null;
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
