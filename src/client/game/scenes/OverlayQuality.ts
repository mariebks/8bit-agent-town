export interface OverlayQualityProfile {
  updateStride: number;
  pathSampleStep: number;
  suppressPerception: boolean;
}

export function overlayStrideForFps(fps: number): number {
  if (fps < 35) {
    return 4;
  }
  if (fps < 50) {
    return 2;
  }
  return 1;
}

export function overlayPathSampleStepForStride(stride: number): number {
  if (stride >= 4) {
    return 4;
  }
  if (stride >= 2) {
    return 2;
  }
  return 1;
}

export function shouldSuppressPerceptionOverlay(stride: number): boolean {
  return stride >= 4;
}

export function overlayQualityProfileForFps(fps: number): OverlayQualityProfile {
  const updateStride = overlayStrideForFps(fps);
  return {
    updateStride,
    pathSampleStep: overlayPathSampleStepForStride(updateStride),
    suppressPerception: shouldSuppressPerceptionOverlay(updateStride),
  };
}
