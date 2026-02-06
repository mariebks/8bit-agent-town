import { describe, expect, test } from 'vitest';
import { TickScheduler } from './TickScheduler';

describe('TickScheduler', () => {
  test('processes elapsed time into monotonic ticks', () => {
    const scheduler = new TickScheduler({ tickIntervalMs: 200, maxCatchUpTicks: 5 });
    const ticks: number[] = [];

    scheduler.onTick((tickId) => ticks.push(tickId));

    const processed = scheduler.processElapsed(620);

    expect(processed).toBe(3);
    expect(ticks).toEqual([1, 2, 3]);
    expect(scheduler.getCurrentTickId()).toBe(3);
  });

  test('caps catch-up ticks to avoid spiral', () => {
    const scheduler = new TickScheduler({ tickIntervalMs: 200, maxCatchUpTicks: 2 });
    const ticks: number[] = [];

    scheduler.onTick((tickId) => ticks.push(tickId));

    const processed = scheduler.processElapsed(1200);

    expect(processed).toBe(2);
    expect(ticks).toEqual([1, 2]);
  });
});
