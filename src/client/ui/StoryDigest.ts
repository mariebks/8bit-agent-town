import { AgentData } from '@shared/Types';
import { TimelineEntry, extractTimelineEntries } from './TimelineEvents';

export interface DigestItem {
  id: string;
  headline: string;
  detail?: string;
  tickId: number;
  kind: TimelineEntry['kind'];
  score: number;
  agentId?: string;
}

const KIND_SCORE: Record<TimelineEntry['kind'], number> = {
  relationship: 10,
  conversation: 9,
  topic: 8,
  reflection: 7,
  plan: 6,
  arrival: 4,
  system: 2,
};

export function extractDigestItems(events: unknown[], context: { tickId: number; agents: AgentData[] }): DigestItem[] {
  const timeline = extractTimelineEntries(events, {
    tickId: context.tickId,
    agents: context.agents.map((agent) => ({ id: agent.id, name: agent.name })),
  });

  return timeline
    .map((entry) => ({
      id: entry.id,
      headline: entry.headline,
      detail: entry.detail,
      tickId: entry.tickId,
      kind: entry.kind,
      score: scoreEntry(entry),
      agentId: entry.agentId,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.tickId - left.tickId;
    });
}

export function selectDigestHighlights(items: DigestItem[], maxItems = 3): DigestItem[] {
  if (maxItems <= 0) {
    return [];
  }

  const sorted = [...items].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.tickId - left.tickId;
  });

  const selected: DigestItem[] = [];
  for (const candidate of sorted) {
    const normalizedCandidate = normalizeDigestHeadline(candidate.headline);
    const nearDuplicate = selected.some((item) => {
      const normalized = normalizeDigestHeadline(item.headline);
      return digestHeadlineSimilarity(normalized, normalizedCandidate) >= 0.72;
    });
    if (nearDuplicate) {
      continue;
    }

    selected.push(candidate);
    if (selected.length >= maxItems) {
      break;
    }
  }

  return selected;
}

function scoreEntry(entry: TimelineEntry): number {
  const base = KIND_SCORE[entry.kind] ?? 1;
  const detailBoost = entry.detail && entry.detail.length > 0 ? 0.6 : 0;
  const actorBoost = entry.actorIds.length >= 2 ? 0.8 : entry.actorIds.length > 0 ? 0.4 : 0;
  return base + detailBoost + actorBoost;
}

function normalizeDigestHeadline(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function digestHeadlineSimilarity(left: string, right: string): number {
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
