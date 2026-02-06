import { describe, expect, test } from 'vitest';
import { TimeManager } from './TimeManager';

describe('TimeManager', () => {
  test('advances game time according to speed multiplier', () => {
    const manager = new TimeManager(0);

    manager.tick(10);
    expect(manager.getGameTime().totalMinutes).toBe(10);

    manager.setSpeed(4);
    manager.tick(5);
    expect(manager.getGameTime().totalMinutes).toBe(30);
  });

  test('pause prevents advancement', () => {
    const manager = new TimeManager(100);
    manager.pause();
    manager.tick(10);
    expect(manager.getGameTime().totalMinutes).toBe(100);

    manager.resume();
    manager.tick(1);
    expect(manager.getGameTime().totalMinutes).toBe(101);
  });

  test('fires day boundary callback exactly once per day crossed', () => {
    const manager = new TimeManager(1438);
    const days: number[] = [];

    manager.onDayBoundary((time) => days.push(time.day));

    manager.tick(5);
    manager.tick(1440);

    expect(days).toEqual([1, 2]);
  });
});
