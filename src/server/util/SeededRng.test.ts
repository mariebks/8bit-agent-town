import { describe, expect, test } from 'vitest';
import { SeededRng } from './SeededRng';

describe('SeededRng', () => {
  test('produces deterministic sequences for identical seeds', () => {
    const a = new SeededRng(123);
    const b = new SeededRng(123);

    const aSequence = Array.from({ length: 8 }, () => a.next());
    const bSequence = Array.from({ length: 8 }, () => b.next());

    expect(aSequence).toEqual(bSequence);
  });

  test('range stays within inclusive bounds', () => {
    const rng = new SeededRng(7);

    for (let i = 0; i < 100; i += 1) {
      const value = rng.range(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  test('pick returns members from source array', () => {
    const rng = new SeededRng(5);
    const values = ['a', 'b', 'c'];

    for (let i = 0; i < 20; i += 1) {
      expect(values).toContain(rng.pick(values));
    }
  });
});
