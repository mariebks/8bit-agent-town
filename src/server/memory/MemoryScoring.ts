import { Memory } from './Types';

export function calculateRecency(memoryTime: number, currentTime: number, halfLifeMinutes = 360): number {
  const ageMinutes = currentTime - memoryTime;
  if (ageMinutes <= 0) {
    return 1;
  }

  return 0.5 ** (ageMinutes / halfLifeMinutes);
}

export function calculateImportance(importance: number): number {
  if (!Number.isFinite(importance)) {
    return 0;
  }
  return Math.max(0, Math.min(1, importance / 10));
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function calculateRelevance(memory: Memory, query: string, contextTerms: string[] = []): number {
  const queryTokens = new Set([...tokenize(query), ...contextTerms.map((term) => term.toLowerCase())]);
  if (queryTokens.size === 0) {
    return 0;
  }

  const memoryTokens = new Set([...memory.keywords.map((keyword) => keyword.toLowerCase()), ...tokenize(memory.content)]);
  let overlap = 0;

  for (const token of queryTokens) {
    if (memoryTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / queryTokens.size;
}

export function scoreMemory(memory: Memory, currentTime: number, query: string, contextTerms: string[] = []): {
  score: number;
  recency: number;
  importance: number;
  relevance: number;
} {
  const recency = calculateRecency(memory.timestamp, currentTime);
  const importance = calculateImportance(memory.importance);
  const relevance = calculateRelevance(memory, query, contextTerms);
  const score = 0.5 * recency + 0.3 * importance + 0.2 * relevance;

  return {
    score,
    recency,
    importance,
    relevance,
  };
}
