import { describe, expect, test } from 'vitest';
import { dequeueDirectorCue, enqueueDirectorCue } from './DirectorQueue';

describe('DirectorQueue', () => {
  test('keeps highest-priority cues and dedupes by agent', () => {
    const queue = enqueueDirectorCue(
      enqueueDirectorCue(
        enqueueDirectorCue([], { agentId: 'a1', reason: 'topic', priority: 1 }, 2),
        { agentId: 'a2', reason: 'conversation', priority: 2 },
        2,
      ),
      { agentId: 'a1', reason: 'relationship', priority: 3 },
      2,
    );

    expect(queue).toHaveLength(2);
    expect(queue[0].agentId).toBe('a1');
    expect(queue[0].priority).toBe(3);
  });

  test('dequeues highest-priority cue first', () => {
    const queue = [
      { agentId: 'a1', reason: 'topic', priority: 1 },
      { agentId: 'a2', reason: 'relationship', priority: 3 },
      { agentId: 'a3', reason: 'conversation', priority: 2 },
    ];
    const { cue, nextQueue } = dequeueDirectorCue(queue);
    expect(cue?.agentId).toBe('a2');
    expect(nextQueue).toHaveLength(2);
  });
});
