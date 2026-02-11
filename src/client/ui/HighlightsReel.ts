import { AgentData } from '@shared/Types';
import { TimelineEntry } from './TimelineEvents';

export interface HighlightsEntry extends TimelineEntry {
  gameMinute?: number;
}

export interface HighlightsReelSnapshot {
  summary: string;
  bullets: string[];
  topAgentId: string | null;
  topAgentName: string | null;
  eventCount: number;
}

export function buildHighlightsReel(
  entries: HighlightsEntry[],
  agents: AgentData[],
  currentTickId: number,
  windowTicks = 60,
  currentGameMinute: number | null = null,
  windowMinutes = 60,
): HighlightsReelSnapshot {
  const useMinuteWindow = currentGameMinute !== null && entries.some((entry) => typeof entry.gameMinute === 'number');
  const recent = entries.filter((entry) => {
    if (useMinuteWindow) {
      if (typeof entry.gameMinute !== 'number') {
        return currentTickId - entry.tickId <= windowTicks;
      }
      return currentGameMinute - entry.gameMinute <= windowMinutes;
    }
    return currentTickId - entry.tickId <= windowTicks;
  });
  if (recent.length === 0) {
    return {
      summary: 'No major moments in the last hour yet.',
      bullets: [],
      topAgentId: null,
      topAgentName: null,
      eventCount: 0,
    };
  }

  const counts = new Map<TimelineEntry['kind'], number>();
  const agentMentions = new Map<string, number>();
  for (const entry of recent) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    if (entry.agentId) {
      agentMentions.set(entry.agentId, (agentMentions.get(entry.agentId) ?? 0) + 1);
    }
  }

  const topKinds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`);
  const topAgentId = [...agentMentions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topAgentName = topAgentId ? agents.find((agent) => agent.id === topAgentId)?.name ?? topAgentId : null;

  const bullets = recent
    .slice()
    .sort((left, right) => scoreHighlight(right) - scoreHighlight(left))
    .slice(0, 3)
    .map((entry) => entry.headline);

  return {
    summary: topAgentName
      ? `Last hour: ${topKinds.join(', ')}. Spotlight: ${topAgentName}.`
      : `Last hour: ${topKinds.join(', ')}.`,
    bullets,
    topAgentId,
    topAgentName,
    eventCount: recent.length,
  };
}

function scoreHighlight(entry: HighlightsEntry): number {
  const kindWeight: Record<HighlightsEntry['kind'], number> = {
    relationship: 10,
    conversation: 9,
    topic: 8,
    reflection: 6,
    plan: 5,
    arrival: 3,
    system: 1,
  };
  const detailWeight = entry.detail ? 0.5 : 0;
  return kindWeight[entry.kind] + detailWeight + entry.actorIds.length * 0.15 + entry.tickId * 0.0001;
}
