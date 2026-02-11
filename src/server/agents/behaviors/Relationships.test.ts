import { describe, expect, test } from 'vitest';
import { RelationshipManager } from './Relationships';

describe('RelationshipManager', () => {
  test('initializes directed edges and updates weights with caps', () => {
    const manager = new RelationshipManager();
    manager.initialize(['a1', 'a2'], 0);

    expect(manager.getWeight('a1', 'a2')).toBe(0);

    const noShift = manager.applyConversationDelta('a1', 'a2', 30, 100);
    expect(manager.getWeight('a1', 'a2')).toBe(30);
    expect(manager.getWeight('a2', 'a1')).toBe(24);
    expect(noShift).toEqual([]);

    const shift = manager.applyConversationDelta('a1', 'a2', 200, 101);
    expect(manager.getWeight('a1', 'a2')).toBe(100);
    expect(shift).toEqual([
      {
        sourceId: 'a1',
        targetId: 'a2',
        fromWeight: 30,
        toWeight: 100,
        stance: 'friend',
      },
      {
        sourceId: 'a2',
        targetId: 'a1',
        fromWeight: 24,
        toWeight: 100,
        stance: 'friend',
      },
    ]);

    const summary = manager.getSummary('a1');
    expect(summary.friendCount).toBe(1);
    expect(summary.rivalCount).toBe(0);
    expect(summary.strongestBondId).toBe('a2');
  });

  test('serializes graph structure', () => {
    const manager = new RelationshipManager();
    manager.initialize(['a1', 'a2', 'a3'], 0);

    const graph = manager.toSerializable();
    expect(graph.a1).toHaveLength(2);
    expect(graph.a2).toHaveLength(2);
    expect(graph.a3).toHaveLength(2);
  });

  test('returns sorted edge list for a selected agent', () => {
    const manager = new RelationshipManager();
    manager.initialize(['a1', 'a2', 'a3'], 0);
    manager.applyConversationDelta('a1', 'a2', 20, 1);
    manager.applyConversationDelta('a1', 'a3', -10, 2);

    const edges = manager.getEdges('a1');
    expect(edges).toHaveLength(2);
    expect(edges[0].targetId).toBe('a2');
    expect(edges[1].targetId).toBe('a3');
    expect(edges[0].weight).toBeGreaterThan(edges[1].weight);
  });
});
