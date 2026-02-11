type ConversationIntent = 'bond' | 'inform' | 'coordinate' | 'vent';

export interface RewriteContext {
  topic: string;
  intent: ConversationIntent;
  turnGoal: string;
}

export function normalizeDialogue(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function lineSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftSet = new Set(left.split(' '));
  const rightSet = new Set(right.split(' '));
  const intersection = [...leftSet].filter((word) => rightSet.has(word)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

export function shouldRewriteCandidate(candidate: string, topic: string, lastLines: string[]): boolean {
  const normalizedCandidate = normalizeDialogue(candidate);
  const normalizedTopic = normalizeDialogue(topic);
  const duplicate = lastLines.some((line) => lineSimilarity(normalizeDialogue(line), normalizedCandidate) >= 0.84);
  const weak = normalizedCandidate.length < 24 || !normalizedCandidate.includes(normalizedTopic);
  return duplicate || weak;
}

export function rewriteFallbackCandidates(context: RewriteContext): string[] {
  const action = intentAction(context.intent);
  return [
    `New angle: ${context.topic} might shift by tomorrow morning.`,
    `Let us revisit ${context.topic} after we gather one more concrete detail.`,
    `I do not want to loop on ${context.topic}; we can try one small experiment first.`,
    `For ${context.topic}, we should keep this practical and ${action} with a clear next step.`,
    `I think ${context.topic} gets easier if we focus on this goal: ${context.turnGoal}.`,
    `Before we overthink ${context.topic}, I suggest we ${action} and check back later.`,
    `I hear the same points repeating on ${context.topic}; let us lock one decision and move.`,
    `Short version on ${context.topic}: we align now, then verify in the next round.`,
  ];
}

export function pickRewriteCandidate(candidates: string[], lastLines: string[], startIndex: number): string {
  if (candidates.length === 0) {
    return 'Let us revisit this after a short pause.';
  }

  const offset = ((startIndex % candidates.length) + candidates.length) % candidates.length;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[(offset + index) % candidates.length];
    const normalizedCandidate = normalizeDialogue(candidate);
    const isSimilar = lastLines.some((line) => lineSimilarity(normalizeDialogue(line), normalizedCandidate) >= 0.74);
    if (!isSimilar) {
      return candidate;
    }
  }

  return candidates[offset];
}

function intentAction(intent: ConversationIntent): string {
  if (intent === 'bond') {
    return 'stay in sync';
  }
  if (intent === 'inform') {
    return 'share the key facts';
  }
  if (intent === 'coordinate') {
    return 'split responsibilities';
  }
  return 'release pressure';
}
