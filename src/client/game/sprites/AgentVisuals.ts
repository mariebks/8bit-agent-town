export type FacingDirection = 'down' | 'left' | 'right' | 'up';

export interface AgentPalette {
  outline: number;
  skin: number;
  hair: number;
  outfit: number;
  outfitDark: number;
  accent: number;
}

const SKIN_TONES = [0xf5d5b5, 0xe8be96, 0xd0996c, 0xaf7b4f];
const HAIR_TONES = [0x2b1f18, 0x4b3628, 0x6e4d2d, 0x4d4d4d];

const FRAME_LOOKUP: Record<FacingDirection, { idle: number; step: number }> = {
  down: { idle: 0, step: 1 },
  left: { idle: 2, step: 3 },
  right: { idle: 4, step: 5 },
  up: { idle: 6, step: 7 },
};

export function resolveFacingDirection(dx: number, dy: number, previous: FacingDirection = 'down'): FacingDirection {
  if (Math.abs(dx) + Math.abs(dy) < 0.01) {
    return previous;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'down' : 'up';
}

export function frameIndexFor(direction: FacingDirection, stepping: boolean): number {
  const frames = FRAME_LOOKUP[direction];
  return stepping ? frames.step : frames.idle;
}

export function deriveAgentPalette(baseColor: number, agentId: string, occupation?: string): AgentPalette {
  const seed = hashString(`${agentId}:${baseColor.toString(16)}:${occupation ?? ''}`);
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = HAIR_TONES[(seed >>> 3) % HAIR_TONES.length];
  const outfit = mix(baseColor, 0x2f473b, 0.14);
  const outfitDark = shade(outfit, 0.66);
  const accent = mix(baseColor, 0xd6f0ad, 0.32);

  return {
    outline: 0x15202a,
    skin,
    hair,
    outfit,
    outfitDark,
    accent,
  };
}

export function spriteTextureKeyForAgent(agentId: string, baseColor: number, occupation?: string): string {
  const seed = hashString(`${agentId}:${baseColor.toString(16)}:${occupation ?? ''}`);
  return `agent-sprite-${seed.toString(36)}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shade(color: number, factor: number): number {
  const clamped = Math.max(0, factor);
  const red = clampChannel(((color >> 16) & 0xff) * clamped);
  const green = clampChannel(((color >> 8) & 0xff) * clamped);
  const blue = clampChannel((color & 0xff) * clamped);
  return (red << 16) | (green << 8) | blue;
}

function mix(left: number, right: number, amount: number): number {
  const clamped = Math.max(0, Math.min(1, amount));
  const leftRed = (left >> 16) & 0xff;
  const leftGreen = (left >> 8) & 0xff;
  const leftBlue = left & 0xff;
  const rightRed = (right >> 16) & 0xff;
  const rightGreen = (right >> 8) & 0xff;
  const rightBlue = right & 0xff;

  const red = clampChannel(leftRed + (rightRed - leftRed) * clamped);
  const green = clampChannel(leftGreen + (rightGreen - leftGreen) * clamped);
  const blue = clampChannel(leftBlue + (rightBlue - leftBlue) * clamped);

  return (red << 16) | (green << 8) | blue;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
