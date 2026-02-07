import { describe, expect, test } from 'vitest';
import { deriveAgentPalette, frameIndexFor, resolveFacingDirection, spriteTextureKeyForAgent } from './AgentVisuals';

describe('AgentVisuals', () => {
  test('resolves facing direction from movement deltas', () => {
    expect(resolveFacingDirection(2, 0.4, 'down')).toBe('right');
    expect(resolveFacingDirection(-2, 0.2, 'down')).toBe('left');
    expect(resolveFacingDirection(0.2, -2, 'down')).toBe('up');
    expect(resolveFacingDirection(0.2, 2, 'up')).toBe('down');
    expect(resolveFacingDirection(0, 0, 'left')).toBe('left');
  });

  test('maps facing and step phase to sprite-sheet frame indices', () => {
    expect(frameIndexFor('down', false)).toBe(0);
    expect(frameIndexFor('down', true)).toBe(1);
    expect(frameIndexFor('left', false)).toBe(2);
    expect(frameIndexFor('left', true)).toBe(3);
    expect(frameIndexFor('right', false)).toBe(4);
    expect(frameIndexFor('right', true)).toBe(5);
    expect(frameIndexFor('up', false)).toBe(6);
    expect(frameIndexFor('up', true)).toBe(7);
  });

  test('derives deterministic palette and texture key for each agent identity', () => {
    const paletteA = deriveAgentPalette(0x55aa33, 'agent-a', 'Farmer');
    const paletteARepeat = deriveAgentPalette(0x55aa33, 'agent-a', 'Farmer');
    const paletteB = deriveAgentPalette(0x55aa33, 'agent-b', 'Farmer');
    const paletteRoleVariant = deriveAgentPalette(0x55aa33, 'agent-a', 'Librarian');

    expect(paletteA).toEqual(paletteARepeat);
    expect(paletteA).not.toEqual(paletteB);
    expect(paletteA).not.toEqual(paletteRoleVariant);
    for (const value of Object.values(paletteA)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffff);
    }

    const keyA = spriteTextureKeyForAgent('agent-a', 0x55aa33, 'Farmer');
    const keyARepeat = spriteTextureKeyForAgent('agent-a', 0x55aa33, 'Farmer');
    const keyB = spriteTextureKeyForAgent('agent-b', 0x55aa33, 'Farmer');
    const keyRoleVariant = spriteTextureKeyForAgent('agent-a', 0x55aa33, 'Librarian');
    expect(keyA).toBe(keyARepeat);
    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyRoleVariant);
  });
});
