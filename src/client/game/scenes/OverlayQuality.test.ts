import { describe, expect, test } from 'vitest';
import {
  overlayPathSampleStepForStride,
  overlayQualityProfileForFps,
  overlayStrideForFps,
  shouldSuppressPerceptionOverlay,
} from './OverlayQuality';

describe('OverlayQuality', () => {
  test('maps fps to overlay update stride', () => {
    expect(overlayStrideForFps(60)).toBe(1);
    expect(overlayStrideForFps(45)).toBe(2);
    expect(overlayStrideForFps(30)).toBe(4);
  });

  test('maps stride to path downsample step', () => {
    expect(overlayPathSampleStepForStride(1)).toBe(1);
    expect(overlayPathSampleStepForStride(2)).toBe(2);
    expect(overlayPathSampleStepForStride(4)).toBe(4);
  });

  test('suppresses perception overlay only on highest throttle', () => {
    expect(shouldSuppressPerceptionOverlay(1)).toBe(false);
    expect(shouldSuppressPerceptionOverlay(2)).toBe(false);
    expect(shouldSuppressPerceptionOverlay(4)).toBe(true);
  });

  test('builds coherent quality profile from fps', () => {
    expect(overlayQualityProfileForFps(58)).toEqual({
      updateStride: 1,
      pathSampleStep: 1,
      suppressPerception: false,
    });

    expect(overlayQualityProfileForFps(34)).toEqual({
      updateStride: 4,
      pathSampleStep: 4,
      suppressPerception: true,
    });
  });
});
