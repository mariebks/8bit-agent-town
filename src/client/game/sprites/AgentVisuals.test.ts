import { describe, expect, test } from 'vitest';
import {
  deriveAgentPalette,
  frameIndexFor,
  resolveFacingDirection,
  resolveOccupationSpriteTraits,
  spriteTextureKeyForAgent,
} from './AgentVisuals';

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

  test('maps occupations to stable sprite trait profiles', () => {
    const farmer = resolveOccupationSpriteTraits('Farmer', 'a1');
    const librarian = resolveOccupationSpriteTraits('Librarian', 'a2');
    const guard = resolveOccupationSpriteTraits('Town Guard', 'a3');
    const healer = resolveOccupationSpriteTraits('Medic', 'a4');
    const smith = resolveOccupationSpriteTraits('Blacksmith', 'a5');
    const courier = resolveOccupationSpriteTraits('Courier', 'a6');
    const artist = resolveOccupationSpriteTraits('Musician', 'a7');
    const barista = resolveOccupationSpriteTraits('Barista', 'a8');
    const baker = resolveOccupationSpriteTraits('Baker', 'a9');
    const clerk = resolveOccupationSpriteTraits('Town Hall Clerk', 'a10');
    const student = resolveOccupationSpriteTraits('Student', 'a11');
    const retired = resolveOccupationSpriteTraits('Retired', 'a12');
    const trainer = resolveOccupationSpriteTraits('Trainer', 'a13');
    const unknownA = resolveOccupationSpriteTraits('Inventor', 'seed-a');
    const unknownARepeat = resolveOccupationSpriteTraits('Inventor', 'seed-a');
    const unknownB = resolveOccupationSpriteTraits('Inventor', 'seed-b');

    expect(farmer.headwear).toBe('wideHat');
    expect(farmer.accessory).toBe('apron');
    expect(farmer.bodyType).toBe('broad');
    expect(librarian.accessory).toBe('robe');
    expect(librarian.bodyType).toBe('slim');
    expect(guard.badge).toBe(true);
    expect(healer.accessory).toBe('apron');
    expect(healer.badge).toBe(true);
    expect(smith.bodyType).toBe('broad');
    expect(smith.headwear).toBe('bandana');
    expect(courier.accessory).toBe('satchel');
    expect(courier.outfitPattern).toBe('trim');
    expect(artist.accessory).toBe('satchel');
    expect(artist.outfitPattern).toBe('stripe');
    expect(barista.accessory).toBe('apron');
    expect(barista.headwear).toBe('cap');
    expect(baker.outfitPattern).toBe('stripe');
    expect(clerk.accessory).toBe('robe');
    expect(clerk.badge).toBe(true);
    expect(student.accessory).toBe('satchel');
    expect(student.bodyType).toBe('slim');
    expect(retired.headwear).toBe('wideHat');
    expect(retired.outfitPattern).toBe('plain');
    expect(trainer.headwear).toBe('bandana');
    expect(trainer.outfitPattern).toBe('trim');
    expect(['plain', 'stripe', 'trim']).toContain(unknownA.outfitPattern);
    expect(['slim', 'balanced', 'broad']).toContain(unknownA.bodyType);

    expect(unknownA).toEqual(unknownARepeat);
    expect(unknownA).not.toEqual(unknownB);
  });
});
