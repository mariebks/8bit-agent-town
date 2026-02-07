import { describe, expect, test } from 'vitest';
import { layoutSpeechBubbleOffsets } from './SpeechBubbleLayout';

describe('SpeechBubbleLayout', () => {
  test('keeps preferred offset when bubbles do not collide', () => {
    const offsets = layoutSpeechBubbleOffsets([
      { agentId: 'a', x: 100, y: 100, width: 80, height: 30, preferredOffsetY: -16 },
      { agentId: 'b', x: 250, y: 100, width: 80, height: 30, preferredOffsetY: -16 },
    ]);

    expect(offsets.get('a')).toBe(-16);
    expect(offsets.get('b')).toBe(-16);
  });

  test('stacks overlapping bubbles upward', () => {
    const offsets = layoutSpeechBubbleOffsets(
      [
        { agentId: 'a', x: 100, y: 100, width: 96, height: 36, preferredOffsetY: -16 },
        { agentId: 'b', x: 106, y: 104, width: 96, height: 36, preferredOffsetY: -16 },
      ],
      { minGapPx: 8 },
    );

    expect(offsets.get('a')).toBe(-16);
    expect((offsets.get('b') ?? -16)).toBeLessThan(-16);
  });

  test('prioritizes selected agent bubble for preferred placement', () => {
    const offsets = layoutSpeechBubbleOffsets(
      [
        { agentId: 'a', x: 100, y: 100, width: 100, height: 36, preferredOffsetY: -16, selected: false },
        { agentId: 'b', x: 102, y: 102, width: 100, height: 36, preferredOffsetY: -16, selected: true },
      ],
      { minGapPx: 10 },
    );

    expect(offsets.get('b')).toBe(-16);
    expect((offsets.get('a') ?? -16)).toBeLessThan(-16);
  });
});
