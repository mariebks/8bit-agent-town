export function nextDirectorZoom(currentZoom: number, targetZoom: number, lerpAmount: number): number {
  if (currentZoom > targetZoom + 0.2) {
    return currentZoom;
  }
  return currentZoom + (targetZoom - currentZoom) * lerpAmount;
}
