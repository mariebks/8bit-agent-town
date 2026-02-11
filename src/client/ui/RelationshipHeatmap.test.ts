import { describe, expect, test } from 'vitest';
import { AgentState } from '@shared/Types';
import { buildRelationshipHeatRows } from './RelationshipHeatmap';

describe('RelationshipHeatmap', () => {
  test('maps and sorts relationship rows by strongest absolute weight', () => {
    const rows = buildRelationshipHeatRows(
      {
        id: 'a1',
        name: 'Alex',
        color: 0x44aa66,
        state: AgentState.Idle,
        position: { x: 0, y: 0 },
        tilePosition: { tileX: 0, tileY: 0 },
        relationshipEdges: [
          { targetId: 'a2', weight: 75, tags: ['friend'], lastInteraction: 0 },
          { targetId: 'a3', weight: -80, tags: ['rival'], lastInteraction: 0 },
          { targetId: 'a4', weight: 10, tags: ['acquaintance'], lastInteraction: 0 },
        ],
      },
      [
        { id: 'a2', name: 'Blair', color: 0, state: AgentState.Idle, position: { x: 0, y: 0 }, tilePosition: { tileX: 0, tileY: 0 } },
        { id: 'a3', name: 'Casey', color: 0, state: AgentState.Idle, position: { x: 0, y: 0 }, tilePosition: { tileX: 0, tileY: 0 } },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].targetName).toBe('Casey');
    expect(rows[0].stance).toBe('rival');
    expect(rows[1].stance).toBe('friend');
    expect(rows[2].stance).toBe('neutral');
  });
});
