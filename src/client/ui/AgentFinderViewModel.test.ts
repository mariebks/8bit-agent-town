import { describe, expect, test } from 'vitest';
import { areAgentFinderHitsEqual, prioritizeRecentAgentFinderHits } from './AgentFinderViewModel';

describe('AgentFinderViewModel', () => {
  test('detects equal hit arrays', () => {
    const hits = [
      { id: 'a1', name: 'Alex', occupation: 'Guard' },
      { id: 'a2', name: 'Bea', occupation: null },
    ];
    expect(areAgentFinderHitsEqual(hits, [...hits])).toBe(true);
  });

  test('detects changes in order and fields', () => {
    const left = [
      { id: 'a1', name: 'Alex', occupation: 'Guard' },
      { id: 'a2', name: 'Bea', occupation: null },
    ];
    expect(
      areAgentFinderHitsEqual(left, [
        { id: 'a2', name: 'Bea', occupation: null },
        { id: 'a1', name: 'Alex', occupation: 'Guard' },
      ]),
    ).toBe(false);
    expect(
      areAgentFinderHitsEqual(left, [
        { id: 'a1', name: 'Alex', occupation: 'Farmer' },
        { id: 'a2', name: 'Bea', occupation: null },
      ]),
    ).toBe(false);
  });

  test('prioritizes recent agents without dropping non-recent matches', () => {
    const hits = [
      { id: 'a1', name: 'Alex', occupation: 'Guard' },
      { id: 'a2', name: 'Bea', occupation: null },
      { id: 'a3', name: 'Casey', occupation: 'Baker' },
      { id: 'a4', name: 'Drew', occupation: 'Teacher' },
    ];
    const prioritized = prioritizeRecentAgentFinderHits(hits, ['a3', 'a1'], 4);
    expect(prioritized.map((hit) => hit.id)).toEqual(['a3', 'a1', 'a2', 'a4']);
  });
});
