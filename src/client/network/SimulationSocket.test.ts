import { describe, expect, test } from 'vitest';
import { resolveNextServerTick } from './SimulationSocket';

describe('SimulationSocket tick ordering', () => {
  test('always accepts snapshots and resets tick baseline', () => {
    expect(resolveNextServerTick(10, { type: 'snapshot', tickId: 3, gameTime: anyTime(), agents: [] })).toBe(3);
    expect(resolveNextServerTick(10, { type: 'snapshot', tickId: 12, gameTime: anyTime(), agents: [] })).toBe(12);
  });

  test('accepts only strictly newer deltas', () => {
    expect(resolveNextServerTick(10, { type: 'delta', tickId: 11, gameTime: anyTime(), agents: [] })).toBe(11);
    expect(resolveNextServerTick(10, { type: 'delta', tickId: 10, gameTime: anyTime(), agents: [] })).toBeNull();
    expect(resolveNextServerTick(10, { type: 'delta', tickId: 9, gameTime: anyTime(), agents: [] })).toBeNull();
  });
});

function anyTime() {
  return { day: 0, hour: 8, minute: 0, totalMinutes: 480 };
}
