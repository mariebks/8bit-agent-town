import { describe, expect, test } from 'vitest';
import { areAgentFinderHitsEqual } from './AgentFinderViewModel';

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
});
