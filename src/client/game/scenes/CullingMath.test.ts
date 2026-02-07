import { describe, expect, test } from 'vitest';
import {
  classifyAgentLod,
  DEFAULT_CULLING_CONFIG,
  movementUpdateInterval,
  shouldShowSpeechBubble,
  shouldRenderBubble,
} from './CullingMath';

describe('CullingMath', () => {
  test('classifies near/far/culled by camera distance', () => {
    const centerX = 100;
    const centerY = 100;

    expect(classifyAgentLod(100, 100, centerX, centerY)).toBe('near');
    expect(classifyAgentLod(100 + DEFAULT_CULLING_CONFIG.nearDistancePx + 10, 100, centerX, centerY)).toBe('far');
    expect(classifyAgentLod(100 + DEFAULT_CULLING_CONFIG.cullDistancePx + 10, 100, centerX, centerY)).toBe('culled');
  });

  test('returns movement intervals based on lod', () => {
    expect(movementUpdateInterval('near')).toBe(1);
    expect(movementUpdateInterval('far')).toBe(DEFAULT_CULLING_CONFIG.farUpdateInterval);
    expect(movementUpdateInterval('culled')).toBe(DEFAULT_CULLING_CONFIG.culledUpdateInterval);
  });

  test('renders bubbles only within bubble cull distance', () => {
    const centerX = 200;
    const centerY = 150;
    expect(shouldRenderBubble(centerX, centerY, centerX, centerY)).toBe(true);
    expect(shouldRenderBubble(centerX + DEFAULT_CULLING_CONFIG.bubbleCullDistancePx + 1, centerY, centerX, centerY)).toBe(false);
  });

  test('hides non-selected bubbles when selected-only mode is enabled', () => {
    expect(shouldShowSpeechBubble(true, true, false, false)).toBe(true);
    expect(shouldShowSpeechBubble(false, true, true, true)).toBe(false);
    expect(shouldShowSpeechBubble(false, false, true, true)).toBe(true);
    expect(shouldShowSpeechBubble(false, false, false, true)).toBe(false);
  });
});
