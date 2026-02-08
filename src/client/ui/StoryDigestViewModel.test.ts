import { describe, expect, test } from 'vitest';
import { areDigestItemsEqual } from './StoryDigestViewModel';

describe('StoryDigestViewModel', () => {
  test('detects equal digest lists', () => {
    const rows = [
      { id: 'd1', headline: 'Alex met Blair', tickId: 100, kind: 'conversation' as const, score: 9, agentId: 'a1' },
      { id: 'd2', headline: 'Casey spread gossip', tickId: 101, kind: 'topic' as const, score: 8, agentId: 'a3' },
    ];
    expect(areDigestItemsEqual(rows, [...rows])).toBe(true);
  });

  test('detects digest row differences', () => {
    const left = [{ id: 'd1', headline: 'Alex met Blair', tickId: 100, kind: 'conversation' as const, score: 9, agentId: 'a1' }];
    const right = [{ id: 'd1', headline: 'Alex met Blair again', tickId: 100, kind: 'conversation' as const, score: 9, agentId: 'a1' }];
    expect(areDigestItemsEqual(left, right)).toBe(false);
  });
});
