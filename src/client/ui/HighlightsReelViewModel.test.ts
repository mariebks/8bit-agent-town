import { describe, expect, test } from 'vitest';
import { areHighlightsSnapshotsEqual } from './HighlightsReelViewModel';

describe('HighlightsReelViewModel', () => {
  test('returns false when previous snapshot is missing', () => {
    expect(
      areHighlightsSnapshotsEqual(null, {
        summary: 'hello',
        bullets: ['a'],
        topAgentId: 'a1',
        topAgentName: 'Ada',
        eventCount: 1,
      }),
    ).toBe(false);
  });

  test('returns true for identical snapshots', () => {
    const snapshot = {
      summary: 'Last hour: 2 conversations.',
      bullets: ['A met B', 'C shared plan'],
      topAgentId: 'a1',
      topAgentName: 'Ada',
      eventCount: 2,
    };
    expect(areHighlightsSnapshotsEqual(snapshot, { ...snapshot, bullets: [...snapshot.bullets] })).toBe(true);
  });

  test('returns false when bullets differ', () => {
    const left = {
      summary: 'Last hour: 2 conversations.',
      bullets: ['A met B', 'C shared plan'],
      topAgentId: 'a1',
      topAgentName: 'Ada',
      eventCount: 2,
    };
    const right = {
      ...left,
      bullets: ['A met B', 'D arrived'],
    };
    expect(areHighlightsSnapshotsEqual(left, right)).toBe(false);
  });
});
