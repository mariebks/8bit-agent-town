import { describe, expect, it } from 'vitest';
import { CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN } from '@shared/Constants';
import { canStartDragPan, computePan, computeZoom } from './CameraMath';

describe('CameraMath', () => {
  it('zooms in/out with clamping', () => {
    expect(computeZoom(1, -1)).toBeGreaterThan(1);
    expect(computeZoom(1, 1)).toBeLessThan(1);
    expect(computeZoom(CAMERA_ZOOM_MAX, -1)).toBe(CAMERA_ZOOM_MAX);
    expect(computeZoom(CAMERA_ZOOM_MIN, 1)).toBe(CAMERA_ZOOM_MIN);
  });

  it('computes pan delta from inputs and zoom', () => {
    const result = computePan(
      { left: false, right: true, up: true, down: false },
      1000,
      400,
      2,
    );

    expect(result.dx).toBeCloseTo(200);
    expect(result.dy).toBeCloseTo(-200);
  });

  it('returns zero movement with opposite directions', () => {
    const result = computePan(
      { left: true, right: true, up: false, down: false },
      500,
      300,
      1,
    );

    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('allows drag pan on middle/right button without modifier', () => {
    expect(canStartDragPan('middle', false)).toBe(true);
    expect(canStartDragPan('right', false)).toBe(true);
  });

  it('requires space modifier for left drag pan', () => {
    expect(canStartDragPan('left', false)).toBe(false);
    expect(canStartDragPan('left', true)).toBe(true);
  });
});
