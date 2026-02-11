import { describe, expect, test } from 'vitest';
import { AgentState } from '@shared/Types';
import { extractDigestItems, selectDigestHighlights } from './StoryDigest';

describe('StoryDigest', () => {
  test('prioritizes high-signal story events over arrivals and system logs', () => {
    const items = extractDigestItems(
      [
        { type: 'locationArrival', agentId: 'a1', locationId: 'market' },
        {
          type: 'relationshipShift',
          sourceId: 'a1',
          targetId: 'a2',
          fromWeight: 40,
          toWeight: 62,
          stance: 'friend',
        },
        {
          type: 'topicSpread',
          sourceId: 'a1',
          targetId: 'a3',
          topic: 'harvest',
          confidence: 0.8,
        },
        { type: 'log', level: 'info', message: 'control accepted: pause' },
      ],
      {
        tickId: 120,
        agents: [
          { id: 'a1', name: 'Alex', color: 0x44aa66, state: AgentState.Idle, position: { x: 0, y: 0 }, tilePosition: { tileX: 0, tileY: 0 } },
          { id: 'a2', name: 'Blair', color: 0xaa6644, state: AgentState.Idle, position: { x: 0, y: 0 }, tilePosition: { tileX: 0, tileY: 0 } },
          { id: 'a3', name: 'Casey', color: 0x4466aa, state: AgentState.Idle, position: { x: 0, y: 0 }, tilePosition: { tileX: 0, tileY: 0 } },
        ],
      },
    );

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].kind).toBe('relationship');
    expect(items.find((item) => item.kind === 'system')).toBeDefined();
    expect(items.findIndex((item) => item.kind === 'system')).toBeGreaterThan(items.findIndex((item) => item.kind === 'arrival'));
  });

  test('deduplicates near-identical headlines when selecting top highlights', () => {
    const selected = selectDigestHighlights(
      [
        { id: '1', headline: 'Alex and Blair grew closer', tickId: 100, kind: 'relationship', score: 10 },
        { id: '2', headline: 'Alex & Blair grew closer', tickId: 101, kind: 'relationship', score: 10 },
        { id: '3', headline: 'Casey spread harvest gossip', tickId: 102, kind: 'topic', score: 8 },
      ],
      3,
    );

    expect(selected).toHaveLength(2);
    expect(selected.map((item) => item.id)).toEqual(['2', '3']);
  });
});
