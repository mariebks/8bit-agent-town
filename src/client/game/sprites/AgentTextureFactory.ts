import Phaser from 'phaser';
import { AgentPalette, FacingDirection, frameIndexFor } from './AgentVisuals';

const FRAME_SIZE = 16;
const FRAME_COUNT = 8;

export function ensureAgentSpriteSheet(scene: Phaser.Scene, textureKey: string, palette: AgentPalette): void {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const texture = scene.textures.createCanvas(textureKey, FRAME_SIZE * FRAME_COUNT, FRAME_SIZE);
  const context = texture?.getContext();
  if (!texture || !context) {
    return;
  }

  context.clearRect(0, 0, FRAME_SIZE * FRAME_COUNT, FRAME_SIZE);
  context.imageSmoothingEnabled = false;

  const layout: Array<{ direction: FacingDirection; stepping: boolean }> = [
    { direction: 'down', stepping: false },
    { direction: 'down', stepping: true },
    { direction: 'left', stepping: false },
    { direction: 'left', stepping: true },
    { direction: 'right', stepping: false },
    { direction: 'right', stepping: true },
    { direction: 'up', stepping: false },
    { direction: 'up', stepping: true },
  ];

  for (const frame of layout) {
    const frameIndex = frameIndexFor(frame.direction, frame.stepping);
    drawFrame(context, frameIndex, frame.direction, frame.stepping, palette);
    texture.add(String(frameIndex), 0, frameIndex * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE);
  }

  texture.refresh();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  direction: FacingDirection,
  stepping: boolean,
  palette: AgentPalette,
): void {
  const offsetX = frameIndex * FRAME_SIZE;
  context.clearRect(offsetX, 0, FRAME_SIZE, FRAME_SIZE);

  if (direction === 'down') {
    drawDownFrame(context, offsetX, stepping, palette);
    return;
  }

  if (direction === 'up') {
    drawUpFrame(context, offsetX, stepping, palette);
    return;
  }

  drawSideFrame(context, offsetX, direction === 'right', stepping, palette);
}

function drawDownFrame(
  context: CanvasRenderingContext2D,
  offsetX: number,
  stepping: boolean,
  palette: AgentPalette,
): void {
  const leftArmY = stepping ? 8 : 7;
  const rightArmY = stepping ? 7 : 8;
  const leftLegY = stepping ? 11 : 12;
  const rightLegY = stepping ? 12 : 11;

  pixelRect(context, offsetX, palette.hair, 6, 1, 4, 2);
  pixelRect(context, offsetX, palette.hair, 5, 2, 1, 2);
  pixelRect(context, offsetX, palette.hair, 10, 2, 1, 2);
  pixelRect(context, offsetX, palette.skin, 6, 3, 4, 3);
  pixelRect(context, offsetX, palette.outline, 7, 4, 1, 1);
  pixelRect(context, offsetX, palette.outline, 8, 4, 1, 1);

  pixelRect(context, offsetX, palette.outfit, 5, 6, 6, 5);
  pixelRect(context, offsetX, palette.accent, 5, 9, 6, 1);
  pixelRect(context, offsetX, palette.outfitDark, 4, leftArmY, 1, 4);
  pixelRect(context, offsetX, palette.outfitDark, 11, rightArmY, 1, 4);

  pixelRect(context, offsetX, palette.outfitDark, 6, leftLegY, 2, 3);
  pixelRect(context, offsetX, palette.outfitDark, 8, rightLegY, 2, 3);
  pixelRect(context, offsetX, palette.outline, 5, 6, 6, 1);
}

function drawUpFrame(
  context: CanvasRenderingContext2D,
  offsetX: number,
  stepping: boolean,
  palette: AgentPalette,
): void {
  const armY = stepping ? 8 : 7;
  const leftLegY = stepping ? 12 : 11;
  const rightLegY = stepping ? 11 : 12;

  pixelRect(context, offsetX, palette.hair, 5, 1, 6, 4);
  pixelRect(context, offsetX, palette.skin, 6, 4, 4, 2);
  pixelRect(context, offsetX, palette.outfit, 5, 6, 6, 5);
  pixelRect(context, offsetX, palette.outfitDark, 4, armY, 1, 4);
  pixelRect(context, offsetX, palette.outfitDark, 11, armY, 1, 4);
  pixelRect(context, offsetX, palette.accent, 5, 8, 6, 1);
  pixelRect(context, offsetX, palette.outfitDark, 6, leftLegY, 2, 3);
  pixelRect(context, offsetX, palette.outfitDark, 8, rightLegY, 2, 3);
  pixelRect(context, offsetX, palette.outline, 5, 6, 6, 1);
}

function drawSideFrame(
  context: CanvasRenderingContext2D,
  offsetX: number,
  mirrored: boolean,
  stepping: boolean,
  palette: AgentPalette,
): void {
  const leadLegY = stepping ? 11 : 12;
  const trailLegY = stepping ? 12 : 11;
  const armOffset = stepping ? 1 : 0;

  mirroredRect(context, offsetX, mirrored, palette.hair, 6, 1, 3, 4);
  mirroredRect(context, offsetX, mirrored, palette.skin, 7, 3, 3, 3);
  mirroredRect(context, offsetX, mirrored, palette.outline, 9, 4, 1, 1);
  mirroredRect(context, offsetX, mirrored, palette.outfit, 6, 6, 5, 5);
  mirroredRect(context, offsetX, mirrored, palette.outfitDark, 5, 7 + armOffset, 1, 4);
  mirroredRect(context, offsetX, mirrored, palette.accent, 6, 8, 5, 1);
  mirroredRect(context, offsetX, mirrored, palette.outfitDark, 7, leadLegY, 2, 3);
  mirroredRect(context, offsetX, mirrored, palette.outfitDark, 9, trailLegY, 1, 3);
  mirroredRect(context, offsetX, mirrored, palette.outline, 6, 6, 5, 1);
}

function mirroredRect(
  context: CanvasRenderingContext2D,
  offsetX: number,
  mirrored: boolean,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const mirroredX = mirrored ? FRAME_SIZE - x - width : x;
  pixelRect(context, offsetX, color, mirroredX, y, width, height);
}

function pixelRect(
  context: CanvasRenderingContext2D,
  offsetX: number,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = toCssColor(color);
  context.fillRect(offsetX + x, y, width, height);
}

function toCssColor(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}
