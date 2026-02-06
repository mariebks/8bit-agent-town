import { describe, expect, test } from 'vitest';
import { calculateRecency, calculateRelevance, scoreMemory } from './MemoryScoring';
import { MemorySource, MemoryType } from './Types';

describe('MemoryScoring', () => {
  test('recency decays over time', () => {
    const fresh = calculateRecency(100, 100);
    const stale = calculateRecency(100, 1000);

    expect(fresh).toBeGreaterThan(stale);
    expect(fresh).toBe(1);
  });

  test('relevance tracks keyword overlap', () => {
    const memory = {
      id: 'm1',
      type: MemoryType.Observation,
      content: 'Had coffee in the cafe with Alex',
      timestamp: 100,
      location: 'cafe',
      subjects: ['agent-1'],
      keywords: ['coffee', 'cafe', 'alex'],
      importance: 7,
      accessCount: 0,
      lastAccessed: 100,
      source: MemorySource.Perception,
      isArchived: false,
    };

    expect(calculateRelevance(memory, 'coffee in cafe')).toBeGreaterThan(0.3);
    expect(calculateRelevance(memory, 'sleeping at home')).toBe(0);
  });

  test('combined score is bounded and deterministic', () => {
    const memory = {
      id: 'm2',
      type: MemoryType.Observation,
      content: 'Worked at town hall',
      timestamp: 200,
      location: 'town_hall',
      subjects: ['agent-2'],
      keywords: ['worked', 'town', 'hall'],
      importance: 8,
      accessCount: 0,
      lastAccessed: 200,
      source: MemorySource.Perception,
      isArchived: false,
    };

    const a = scoreMemory(memory, 220, 'town hall');
    const b = scoreMemory(memory, 220, 'town hall');

    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThanOrEqual(1);
    expect(a).toEqual(b);
  });
});
