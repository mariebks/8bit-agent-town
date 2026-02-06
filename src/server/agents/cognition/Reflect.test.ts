import { describe, expect, test } from 'vitest';
import { Agent } from '../Agent';
import { ReflectionSystem } from './Reflect';
import { MemoryStream } from '../../memory/MemoryStream';
import { MemorySource } from '../../memory/Types';

function createAgent(agentId = 'agent-1'): Agent {
  return new Agent(
    {
      id: agentId,
      name: 'Taylor',
      age: 34,
      occupation: {
        id: 'teacher',
        workplace: 'school',
        schedule: { start: 8, end: 16 },
      },
      traits: ['friendly'],
      interests: ['music'],
      bio: 'A thoughtful resident.',
      homeLocation: 'home_1',
      color: 0x44ff44,
    },
    { tileX: 4, tileY: 4 },
  );
}

describe('ReflectionSystem', () => {
  test('generates a reflection after interval and tracks latest reflection', () => {
    const system = new ReflectionSystem(12);
    const agent = createAgent();
    const memory = new MemoryStream(agent.id);

    memory.addObservation({
      content: 'Talked with agent-2 in the park.',
      gameTime: 30,
      location: 'park',
      subjects: ['agent-2'],
      source: MemorySource.Dialogue,
      importance: 7,
    });

    const first = system.maybeReflect(agent, memory, { day: 0, hour: 12, minute: 0, totalMinutes: 720 });
    expect(first.created).toBe(true);
    expect(first.reflectionText).toBeTruthy();

    const immediate = system.maybeReflect(agent, memory, { day: 0, hour: 12, minute: 1, totalMinutes: 721 });
    expect(immediate.created).toBe(false);

    const latest = system.getLatestReflection(memory);
    expect(latest).toContain('Taylor');
  });

  test('falls back to quiet reflection when no recent observations exist', () => {
    const system = new ReflectionSystem(6);
    const agent = createAgent('agent-quiet');
    const memory = new MemoryStream(agent.id);

    const result = system.maybeReflect(agent, memory, { day: 0, hour: 6, minute: 0, totalMinutes: 360 });
    expect(result.created).toBe(true);
    expect(result.reflectionText).toContain('quiet');
  });
});
