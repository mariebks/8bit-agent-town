import { AgentState } from '@shared/Types';
import { describe, expect, test } from 'vitest';
import { appendRelationshipSummarySamples } from './InspectorPanel';

function agent(id: string, averageWeight?: number) {
  return {
    id,
    name: id,
    position: { x: 0, y: 0 },
    tilePosition: { tileX: 0, tileY: 0 },
    state: AgentState.Idle,
    color: 0xffffff,
    relationshipSummary:
      typeof averageWeight === 'number'
        ? {
            friendCount: 0,
            rivalCount: 0,
            averageWeight,
          }
        : undefined,
  };
}

describe('InspectorPanel relationship sampling', () => {
  test('captures relationship summary samples each tick update', () => {
    const history = new Map<string, number[]>();
    const sampledTicks = new Map<string, number>();
    appendRelationshipSummarySamples(history, [agent('a1', 10), agent('a2', -20)], 10, sampledTicks);
    appendRelationshipSummarySamples(history, [agent('a1', 15), agent('a2', -15)], 11, sampledTicks);

    expect(history.get('a1')).toEqual([10, 15]);
    expect(history.get('a2')).toEqual([-20, -15]);
  });

  test('does not duplicate summary samples within the same tick', () => {
    const history = new Map<string, number[]>();
    const sampledTicks = new Map<string, number>();
    appendRelationshipSummarySamples(history, [agent('a1', 10)], 20, sampledTicks);
    appendRelationshipSummarySamples(history, [agent('a1', 10)], 20, sampledTicks);

    expect(history.get('a1')).toEqual([10]);
  });

  test('ignores agents without relationship summary values', () => {
    const history = new Map<string, number[]>();
    const sampledTicks = new Map<string, number>();
    appendRelationshipSummarySamples(history, [agent('a1', 10), agent('a2')], 10, sampledTicks);

    expect(history.get('a1')).toEqual([10]);
    expect(history.has('a2')).toBe(false);
  });
});
