export interface DirectorCue {
  agentId: string;
  reason: string;
  priority: number;
}

export function enqueueDirectorCue(queue: DirectorCue[], cue: DirectorCue, maxSize = 8): DirectorCue[] {
  const existing = queue.find((item) => item.agentId === cue.agentId);
  if (existing) {
    existing.priority = Math.max(existing.priority, cue.priority);
    return normalizeQueue(queue, maxSize);
  }

  return normalizeQueue([...queue, cue], maxSize);
}

export function dequeueDirectorCue(queue: DirectorCue[]): { cue: DirectorCue | null; nextQueue: DirectorCue[] } {
  if (queue.length === 0) {
    return { cue: null, nextQueue: [] };
  }

  const sorted = [...queue].sort((left, right) => right.priority - left.priority);
  const [cue, ...rest] = sorted;
  return { cue, nextQueue: rest };
}

function normalizeQueue(queue: DirectorCue[], maxSize: number): DirectorCue[] {
  return [...queue]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, Math.max(1, maxSize));
}
