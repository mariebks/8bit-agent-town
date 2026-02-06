import { describe, expect, test } from 'vitest';
import { AgentGenerator } from './AgentGenerator';

const LOCATIONS = [
  {
    id: 'home_1',
    name: 'Home 1',
    type: 'residential',
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    tags: ['private'],
  },
  {
    id: 'home_2',
    name: 'Home 2',
    type: 'residential',
    bounds: { x: 1, y: 0, width: 1, height: 1 },
    tags: ['private'],
  },
  {
    id: 'plaza',
    name: 'Plaza',
    type: 'outdoor',
    bounds: { x: 2, y: 0, width: 2, height: 2 },
    tags: ['social'],
  },
];

describe('AgentGenerator', () => {
  test('generates deterministic, uniquely identified profiles', () => {
    const generatorA = new AgentGenerator(123);
    const generatorB = new AgentGenerator(123);

    const profilesA = generatorA.generate(8, LOCATIONS);
    const profilesB = generatorB.generate(8, LOCATIONS);

    expect(profilesA).toEqual(profilesB);

    const ids = new Set(profilesA.map((profile) => profile.id));
    expect(ids.size).toBe(8);
  });

  test('assigns homes across available residential locations', () => {
    const generator = new AgentGenerator(42);
    const profiles = generator.generate(6, LOCATIONS);
    const homes = profiles.map((profile) => profile.homeLocation);

    expect(new Set(homes)).toEqual(new Set(['home_1', 'home_2']));
  });
});
