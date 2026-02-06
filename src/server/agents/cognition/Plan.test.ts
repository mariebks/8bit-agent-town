import { describe, expect, test } from 'vitest';
import { Agent } from '../Agent';
import { MemoryStream } from '../../memory/MemoryStream';
import { PlanningSystem } from './Plan';

function createAgent(agentId = 'agent-1'): Agent {
  return new Agent(
    {
      id: agentId,
      name: 'Alex',
      age: 29,
      occupation: {
        id: 'librarian',
        workplace: 'library',
        schedule: { start: 9, end: 17 },
      },
      traits: ['curious'],
      interests: ['reading'],
      bio: 'Loves books and routines.',
      homeLocation: 'home_1',
      color: 0xff00ff,
    },
    { tileX: 3, tileY: 3 },
  );
}

const locations = [
  {
    id: 'home_1',
    name: 'Home',
    type: 'residential',
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    tags: ['private'],
  },
  {
    id: 'library',
    name: 'Library',
    type: 'public',
    bounds: { x: 1, y: 0, width: 1, height: 1 },
    tags: ['quiet'],
  },
  {
    id: 'cafe',
    name: 'Cafe',
    type: 'commercial',
    bounds: { x: 2, y: 0, width: 1, height: 1 },
    tags: ['food', 'social'],
  },
  {
    id: 'plaza',
    name: 'Plaza',
    type: 'outdoor',
    bounds: { x: 3, y: 0, width: 1, height: 1 },
    tags: ['social'],
  },
];

describe('PlanningSystem', () => {
  test('creates exactly one daily plan after morning boundary', () => {
    const system = new PlanningSystem(7);
    const agent = createAgent();
    const memory = new MemoryStream(agent.id);

    const beforeMorning = system.ensureDailyPlan(agent, memory, { day: 0, hour: 5, minute: 0, totalMinutes: 300 }, locations);
    expect(beforeMorning.created).toBe(false);

    const morning = system.ensureDailyPlan(agent, memory, { day: 0, hour: 6, minute: 0, totalMinutes: 360 }, locations);
    expect(morning.created).toBe(true);
    expect(memory.getCurrentPlan(360)).not.toBeNull();

    const duplicate = system.ensureDailyPlan(agent, memory, { day: 0, hour: 8, minute: 30, totalMinutes: 510 }, locations);
    expect(duplicate.created).toBe(false);
  });

  test('exposes current goals and preview for active plan', () => {
    const system = new PlanningSystem(13);
    const agent = createAgent();
    const memory = new MemoryStream(agent.id);

    system.ensureDailyPlan(agent, memory, { day: 0, hour: 7, minute: 0, totalMinutes: 420 }, locations);

    const goal = system.getCurrentGoal(memory, 420);
    const preview = system.getPlanPreview(memory, 420, 2);
    const next = system.getNextPlanItem(memory, 420);

    expect(goal).toBeTruthy();
    expect(preview.length).toBeGreaterThan(0);
    expect(preview.length).toBeLessThanOrEqual(2);
    expect(next).not.toBeNull();
  });
});
