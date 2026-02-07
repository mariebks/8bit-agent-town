import { describe, expect, test } from 'vitest';
import { enqueueSpeech } from './SpeechQueue';

describe('SpeechQueue', () => {
  test('keeps only the most recent messages within queue limit', () => {
    const queue = enqueueSpeech(
      enqueueSpeech(
        enqueueSpeech(
          [],
          { message: 'first', durationMs: 500 },
          2,
        ),
        { message: 'second', durationMs: 500 },
        2,
      ),
      { message: 'third', durationMs: 500 },
      2,
    );

    expect(queue).toHaveLength(2);
    expect(queue[0].message).toBe('second');
    expect(queue[1].message).toBe('third');
  });
});
