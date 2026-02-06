import { describe, expect, test } from 'vitest';
import { MemoryStream } from './MemoryStream';
import { MemorySource, MemoryType } from './Types';

describe('MemoryStream', () => {
  test('stores and retrieves memories by score', () => {
    const stream = new MemoryStream('agent-1');

    stream.addObservation({
      content: 'Met Jordan at the cafe',
      gameTime: 10,
      location: 'cafe',
      subjects: ['agent-2'],
      source: MemorySource.Dialogue,
      importance: 8,
    });

    stream.addObservation({
      content: 'Walked in the park',
      gameTime: 12,
      location: 'park',
      subjects: [],
      source: MemorySource.Perception,
      importance: 4,
    });

    const top = stream.retrieveTopK('cafe jordan', 15, 1);
    expect(top).toHaveLength(1);
    expect(top[0].memory.content).toContain('cafe');
  });

  test('supports plans and current-plan lookup', () => {
    const stream = new MemoryStream('agent-1');

    stream.addPlan(
      [
        {
          id: 'p1',
          description: 'Go to market',
          targetLocation: 'market',
          priority: 4,
          status: 'pending',
        },
      ],
      100,
      180,
    );

    const current = stream.getCurrentPlan(120);
    expect(current).not.toBeNull();
    expect(current?.planItems[0].targetLocation).toBe('market');
  });

  test('round-trips with toJSON/fromJSON', () => {
    const stream = new MemoryStream('agent-1');
    stream.addObservation({
      content: 'Read a book',
      gameTime: 20,
      location: 'library',
      subjects: [],
      source: MemorySource.Perception,
      importance: 5,
    });

    const serialized = stream.toJSON();
    const restored = MemoryStream.fromJSON(serialized);

    expect(restored.getByType(MemoryType.Observation)).toHaveLength(1);
    expect(restored.getByType(MemoryType.Observation)[0].content).toContain('Read a book');
  });

  test('filters memories by inclusive time range', () => {
    const stream = new MemoryStream('agent-1');
    stream.addObservation({
      content: 'Early memory',
      gameTime: 5,
      location: 'home_1',
      subjects: [],
      source: MemorySource.Perception,
      importance: 3,
    });
    stream.addObservation({
      content: 'Middle memory',
      gameTime: 15,
      location: 'park',
      subjects: [],
      source: MemorySource.Perception,
      importance: 4,
    });
    stream.addObservation({
      content: 'Late memory',
      gameTime: 25,
      location: 'plaza',
      subjects: [],
      source: MemorySource.Perception,
      importance: 5,
    });

    const filtered = stream.getByTimeRange(10, 20);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].content).toBe('Middle memory');
  });
});
