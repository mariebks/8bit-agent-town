import { describe, expect, test } from 'vitest';
import { idleMotionConfigForOccupation, selectionRingStyleForZoom } from './AgentVisualMotion';

describe('AgentVisualMotion', () => {
  test('returns role-aware idle motion profiles', () => {
    expect(idleMotionConfigForOccupation('Town Guard')).toEqual({ amplitudePx: 0.14, frequencyHz: 0.9 });
    expect(idleMotionConfigForOccupation('Farmer')).toEqual({ amplitudePx: 0.22, frequencyHz: 1.2 });
    expect(idleMotionConfigForOccupation('Librarian')).toEqual({ amplitudePx: 0.1, frequencyHz: 0.82 });
    expect(idleMotionConfigForOccupation('Unknown')).toEqual({ amplitudePx: 0.16, frequencyHz: 1 });
  });

  test('boosts selected ring contrast at lower zoom', () => {
    const close = selectionRingStyleForZoom(1.2, true);
    const far = selectionRingStyleForZoom(0.82, true);
    const off = selectionRingStyleForZoom(0.82, false);

    expect(far.strokeWidth).toBeGreaterThan(close.strokeWidth);
    expect(far.fillAlpha).toBeGreaterThan(close.fillAlpha);
    expect(off.haloAlpha).toBe(0);
    expect(far.haloAlpha).toBeGreaterThan(0);
  });
});
