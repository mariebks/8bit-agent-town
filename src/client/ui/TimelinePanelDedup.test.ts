import { describe, expect, test } from 'vitest';
import { shouldAppendTimelineEntry } from './TimelinePanel';
import { TimelineEntry } from './TimelineEvents';

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: overrides.id ?? 'event-1',
    tickId: overrides.tickId ?? 10,
    kind: overrides.kind ?? 'conversation',
    headline: overrides.headline ?? 'Ada chats with Bo',
    detail: overrides.detail ?? 'friendly exchange',
    agentId: overrides.agentId ?? 'agent-1',
    actorIds: overrides.actorIds ?? ['agent-1', 'agent-2'],
  };
}

describe('TimelinePanel dedupe', () => {
  test('drops near-identical consecutive entries within duplicate window', () => {
    const previous = entry({ tickId: 100, headline: 'Ada greets Bo', agentId: 'agent-1', kind: 'conversation' });
    const next = entry({ id: 'event-2', tickId: 104, headline: 'Ada greets Bo', agentId: 'agent-1', kind: 'conversation' });
    expect(shouldAppendTimelineEntry(previous, next)).toBe(false);
  });

  test('keeps similar entries when enough ticks have elapsed', () => {
    const previous = entry({ tickId: 100, headline: 'Ada greets Bo', agentId: 'agent-1', kind: 'conversation' });
    const next = entry({ id: 'event-2', tickId: 107, headline: 'Ada greets Bo', agentId: 'agent-1', kind: 'conversation' });
    expect(shouldAppendTimelineEntry(previous, next)).toBe(true);
  });

  test('keeps entries when kind, agent, or headline differs', () => {
    const previous = entry({ tickId: 100, headline: 'Ada greets Bo', agentId: 'agent-1', kind: 'conversation' });
    expect(shouldAppendTimelineEntry(previous, entry({ id: 'event-2', tickId: 102, kind: 'topic', headline: 'Rumor spreads' }))).toBe(
      true,
    );
    expect(shouldAppendTimelineEntry(previous, entry({ id: 'event-3', tickId: 102, agentId: 'agent-2', headline: 'Ada greets Bo' }))).toBe(
      true,
    );
    expect(shouldAppendTimelineEntry(previous, entry({ id: 'event-4', tickId: 102, headline: 'Bo thanks Ada' }))).toBe(true);
  });

  test('keeps conversation events with matching headline but different actor pairs', () => {
    const previous = entry({
      tickId: 220,
      kind: 'conversation',
      headline: 'Conversation ended',
      agentId: undefined,
      actorIds: ['agent-1', 'agent-2'],
    });
    const next = entry({
      id: 'event-9',
      tickId: 224,
      kind: 'conversation',
      headline: 'Conversation ended',
      agentId: undefined,
      actorIds: ['agent-3', 'agent-4'],
    });
    expect(shouldAppendTimelineEntry(previous, next)).toBe(true);
  });
});
