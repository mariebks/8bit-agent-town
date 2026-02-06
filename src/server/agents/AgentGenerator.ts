import { LocationData, LocationId } from '@shared/Types';
import { SeededRng } from '../util/SeededRng';
import { FIRST_NAMES, INTERESTS, OCCUPATIONS, TRAITS } from './data/profiles';
import { AgentProfile } from './AgentState';

const COLOR_PALETTE = [
  0xff6b6b,
  0x4ecdc4,
  0xffd166,
  0xa78bfa,
  0x60a5fa,
  0xf472b6,
  0x34d399,
  0xfb7185,
  0xf59e0b,
  0x22d3ee,
  0x38bdf8,
  0x818cf8,
];

export class AgentGenerator {
  private readonly rng: SeededRng;
  private readonly usedNames = new Set<string>();

  constructor(seed: number) {
    this.rng = new SeededRng(seed);
  }

  generate(count: number, locations: LocationData[]): AgentProfile[] {
    const homes = locations.filter((location) => location.type === 'residential');

    if (homes.length === 0) {
      throw new Error('AgentGenerator requires at least one residential location');
    }

    const profiles: AgentProfile[] = [];

    for (let index = 0; index < count; index += 1) {
      const name = this.nextUniqueName(index);
      const occupation = this.rng.pick(OCCUPATIONS);
      const homeLocation = homes[index % homes.length].id;
      const traits = this.pickUnique(TRAITS, 2);
      const interests = this.pickUnique(INTERESTS, 2);
      const age = this.rng.range(18, 74);
      const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

      profiles.push({
        id: `agent-${index + 1}`,
        name,
        age,
        occupation,
        traits,
        interests,
        bio: `${name} is a ${occupation.id} who enjoys ${interests.join(' and ')}.`,
        homeLocation,
        color,
      });
    }

    return profiles;
  }

  private nextUniqueName(index: number): string {
    for (let attempt = 0; attempt < FIRST_NAMES.length * 2; attempt += 1) {
      const base = this.rng.pick(FIRST_NAMES);
      const candidate = this.usedNames.has(base) ? `${base} ${index + 1}` : base;
      if (!this.usedNames.has(candidate)) {
        this.usedNames.add(candidate);
        return candidate;
      }
    }

    const fallback = `Resident ${index + 1}`;
    this.usedNames.add(fallback);
    return fallback;
  }

  private pickUnique(pool: readonly string[], count: number): string[] {
    const copied = [...pool];
    const picked: string[] = [];

    for (let i = 0; i < count && copied.length > 0; i += 1) {
      const selected = this.rng.nextInt(copied.length);
      picked.push(copied[selected]);
      copied.splice(selected, 1);
    }

    return picked;
  }

  assignHomes(agentIds: string[], locations: LocationData[]): Map<string, LocationId> {
    const homes = locations.filter((location) => location.type === 'residential').map((location) => location.id);
    const output = new Map<string, LocationId>();

    if (homes.length === 0) {
      return output;
    }

    for (let i = 0; i < agentIds.length; i += 1) {
      output.set(agentIds[i], homes[i % homes.length]);
    }

    return output;
  }
}
