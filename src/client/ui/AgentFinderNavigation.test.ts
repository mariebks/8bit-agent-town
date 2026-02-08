import { describe, expect, test } from 'vitest';
import { nextHighlightedIndex, normalizeHighlightedIndex } from './AgentFinderNavigation';

describe('AgentFinderNavigation', () => {
  test('normalizes highlighted index within result bounds', () => {
    expect(normalizeHighlightedIndex(-1, 3)).toBe(-1);
    expect(normalizeHighlightedIndex(4, 3)).toBe(2);
    expect(normalizeHighlightedIndex(1, 3)).toBe(1);
    expect(normalizeHighlightedIndex(0, 0)).toBe(-1);
  });

  test('cycles highlight index downward and upward', () => {
    expect(nextHighlightedIndex(-1, 3, 'down')).toBe(0);
    expect(nextHighlightedIndex(-1, 3, 'up')).toBe(2);
    expect(nextHighlightedIndex(1, 3, 'down')).toBe(2);
    expect(nextHighlightedIndex(2, 3, 'down')).toBe(0);
    expect(nextHighlightedIndex(0, 3, 'up')).toBe(2);
  });
});
