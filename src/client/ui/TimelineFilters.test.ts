import { describe, expect, test } from 'vitest';
import { matchesTimelineFilter } from './TimelinePanel';
import { TimelineEntry } from './TimelineEvents';

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: overrides.id ?? 'event-1',
    tickId: overrides.tickId ?? 10,
    kind: overrides.kind ?? 'conversation',
    headline: overrides.headline ?? 'Ada talks with Bo',
    detail: overrides.detail ?? 'friendly exchange',
    agentId: overrides.agentId ?? 'agent-1',
    actorIds: overrides.actorIds ?? ['agent-1', 'agent-2'],
  };
}

describe('Timeline filters', () => {
  test('includes expected kinds for social/planning/system filters', () => {
    expect(matchesTimelineFilter(entry({ kind: 'conversation' }), 'social')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'topic' }), 'social')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'arrival' }), 'planning')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'reflection' }), 'planning')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'system' }), 'system')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'plan' }), 'system')).toBe(false);
  });

  test('detects conflict cues from relationship and language', () => {
    expect(matchesTimelineFilter(entry({ kind: 'relationship', headline: 'Ada now sees Bo as rival' }), 'conflict')).toBe(
      true,
    );
    expect(matchesTimelineFilter(entry({ kind: 'conversation', detail: 'social discomfort' }), 'conflict')).toBe(true);
    expect(matchesTimelineFilter(entry({ kind: 'conversation', headline: 'friendly chat' }), 'conflict')).toBe(false);
  });
});
