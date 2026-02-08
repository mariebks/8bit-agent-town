import { describe, expect, test } from 'vitest';
import { idleMotionConfigForOccupation, selectionRingStyleForZoom, shadowStyleForZoom } from './AgentVisualMotion';

describe('AgentVisualMotion', () => {
  test('returns role-aware idle motion profiles', () => {
    expect(idleMotionConfigForOccupation('Town Guard')).toEqual({ amplitudePx: 0.14, frequencyHz: 0.9 });
    expect(idleMotionConfigForOccupation('Farmer')).toEqual({ amplitudePx: 0.22, frequencyHz: 1.2 });
    expect(idleMotionConfigForOccupation('Barista')).toEqual({ amplitudePx: 0.2, frequencyHz: 1.15 });
    expect(idleMotionConfigForOccupation('Town Hall Clerk')).toEqual({ amplitudePx: 0.11, frequencyHz: 0.84 });
    expect(idleMotionConfigForOccupation('Librarian')).toEqual({ amplitudePx: 0.1, frequencyHz: 0.82 });
    expect(idleMotionConfigForOccupation('Student')).toEqual({ amplitudePx: 0.24, frequencyHz: 1.3 });
    expect(idleMotionConfigForOccupation('Retired')).toEqual({ amplitudePx: 0.08, frequencyHz: 0.72 });
    expect(idleMotionConfigForOccupation('Trainer')).toEqual({ amplitudePx: 0.24, frequencyHz: 1.25 });
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

  test('boosts shadow presence for selected agents and low zoom', () => {
    const normal = shadowStyleForZoom(1, false);
    const selected = shadowStyleForZoom(1, true);
    const zoomedOut = shadowStyleForZoom(0.78, false);

    expect(normal.width).toBeGreaterThan(0);
    expect(normal.height).toBeGreaterThan(0);
    expect(normal.alpha).toBeGreaterThan(0);

    expect(selected.width).toBeGreaterThan(normal.width);
    expect(selected.height).toBeGreaterThan(normal.height);
    expect(selected.alpha).toBeGreaterThan(normal.alpha);

    expect(zoomedOut.width).toBeGreaterThan(normal.width);
    expect(zoomedOut.alpha).toBeGreaterThan(normal.alpha);
  });
});
