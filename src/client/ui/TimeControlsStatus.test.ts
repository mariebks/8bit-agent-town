import { describe, expect, test } from 'vitest';
import { TimeControlsStatus } from './TimeControlsStatus';

describe('TimeControlsStatus', () => {
  test('returns transient status until it expires', () => {
    let now = 10_000;
    const status = new TimeControlsStatus(() => now, 1_000);

    status.setTransient('focused agent-2');
    expect(status.resolve('Day 0 12:00 | tick 42 | online')).toBe('focused agent-2');

    now += 999;
    expect(status.resolve('Day 0 12:01 | tick 43 | online')).toBe('focused agent-2');
  });

  test('falls back to base status after expiration', () => {
    let now = 5_000;
    const status = new TimeControlsStatus(() => now, 500);

    status.setTransient('bookmarked agent-1');
    now += 500;

    expect(status.resolve('Day 0 09:05 | tick 20 | online')).toBe('Day 0 09:05 | tick 20 | online');
  });
});

