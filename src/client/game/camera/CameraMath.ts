import { CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN, CAMERA_ZOOM_STEP } from '@shared/Constants';

export interface PanInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface PanResult {
  dx: number;
  dy: number;
}

export function computeZoom(currentZoom: number, wheelDeltaY: number): number {
  const change = wheelDeltaY > 0 ? -CAMERA_ZOOM_STEP : CAMERA_ZOOM_STEP;
  const zoom = currentZoom + change;
  return Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, zoom));
}

export function computePan(
  input: PanInputState,
  deltaMs: number,
  speedPxPerSecond: number,
  zoom: number,
): PanResult {
  let axisX = 0;
  let axisY = 0;

  if (input.left) axisX -= 1;
  if (input.right) axisX += 1;
  if (input.up) axisY -= 1;
  if (input.down) axisY += 1;

  const worldSpeed = (speedPxPerSecond * deltaMs) / 1000;

  return {
    dx: (axisX * worldSpeed) / zoom,
    dy: (axisY * worldSpeed) / zoom,
  };
}

export function canStartDragPan(button: 'left' | 'middle' | 'right', isSpaceDown: boolean): boolean {
  if (button === 'middle' || button === 'right') {
    return true;
  }

  return button === 'left' && isSpaceDown;
}
