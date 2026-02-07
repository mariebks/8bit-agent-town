import { describe, expect, test } from 'vitest';
import { extractTimelineEntries } from './TimelineEvents';

describe('TimelineEvents', () => {
  test('maps key event types into timeline entries', () => {
    const entries = extractTimelineEntries(
      [
        {
          type: 'conversationStart',
          conversationId: 'conv-1',
          participants: ['a1', 'a2'],
          location: 'town_hall',
        },
        {
          type: 'relationshipShift',
          sourceId: 'a1',
          targetId: 'a2',
          stance: 'friend',
          fromWeight: 58,
          toWeight: 61,
        },
        {
          type: 'locationArrival',
          agentId: 'a1',
          locationId: 'market',
        },
        {
          type: 'log',
          level: 'info',
          message: 'Generated daily plan for Alex',
          agentId: 'a1',
        },
        {
          type: 'log',
          level: 'info',
          message: 'Reflection added for Alex',
          agentId: 'a1',
        },
      ],
      {
        tickId: 88,
        agents: [
          { id: 'a1', name: 'Alex' },
          { id: 'a2', name: 'Blair' },
        ],
      },
    );

    expect(entries).toHaveLength(5);
    expect(entries.map((entry) => entry.kind)).toEqual([
      'conversation',
      'relationship',
      'arrival',
      'plan',
      'reflection',
    ]);
    expect(entries[0].headline).toContain('Alex');
    expect(entries[0].headline).toContain('Blair');
    expect(entries[2].headline).toContain('market');
  });

  test('de-dupes repeated events within the same tick', () => {
    const entries = extractTimelineEntries(
      [
        {
          type: 'log',
          level: 'info',
          message: 'Generated daily plan for Alex',
          agentId: 'a1',
        },
        {
          type: 'log',
          level: 'info',
          message: 'Generated daily plan for Alex',
          agentId: 'a1',
        },
      ],
      {
        tickId: 12,
        agents: [{ id: 'a1', name: 'Alex' }],
      },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('plan');
  });
});
