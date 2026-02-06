import { describe, expect, test } from 'vitest';
import { AgentManager } from './AgentManager';
import { Agent } from './Agent';
import { DecisionMaker } from './DecisionMaker';
import { MemoryStream } from '../memory/MemoryStream';
import { NavGrid } from '../world/NavGrid';
import { Pathfinding } from '../world/Pathfinding';
import { Town } from '../world/Town';

function createAgent(agentId: string, startTile = { tileX: 3, tileY: 3 }): Agent {
  return new Agent(
    {
      id: agentId,
      name: `Agent ${agentId}`,
      age: 26,
      occupation: { id: 'teacher', workplace: 'school', schedule: { start: 8, end: 16 } },
      traits: ['calm'],
      interests: ['reading'],
      bio: 'Test profile',
      homeLocation: 'home_1',
      color: 0xffffff,
    },
    startTile,
  );
}

function createTown(): Town {
  return new Town([
    {
      id: 'home_1',
      name: 'Home',
      type: 'residential',
      bounds: { x: 0, y: 0, width: 6, height: 6 },
      tags: ['private'],
      spawnPoint: { tileX: 3, tileY: 3 },
    },
    {
      id: 'library',
      name: 'Library',
      type: 'public',
      bounds: { x: 7, y: 7, width: 4, height: 4 },
      tags: ['quiet'],
      spawnPoint: { tileX: 8, tileY: 8 },
    },
  ]);
}

describe('DecisionMaker', () => {
  test('prioritizes due plan items before rule-based wandering', () => {
    const agent = createAgent('agent-1');
    const manager = new AgentManager([agent]);
    const memory = new MemoryStream(agent.id);
    const town = createTown();
    const nav = new NavGrid(Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)));
    const pathfinding = new Pathfinding(nav);
    const decisionMaker = new DecisionMaker(9, { llmEnabledAgents: 0, minDecisionIntervalTicks: 1, maxDecisionIntervalTicks: 1 });

    memory.addPlan(
      [
        {
          id: 'plan-1',
          description: 'Visit library for quiet study',
          targetLocation: 'library',
          targetTime: 0,
          priority: 5,
          status: 'pending',
        },
      ],
      0,
      1_440,
    );

    decisionMaker.update({
      tickId: 1,
      gameTime: { day: 0, hour: 8, minute: 0, totalMinutes: 480 },
      agentManager: manager,
      pathfinding,
      walkableWaypoints: [{ tileX: 10, tileY: 10 }],
      town,
      memoryByAgent: new Map([[agent.id, memory]]),
    });

    expect(agent.getCurrentAction()).toContain('plan:');
    expect(agent.hasActivePath()).toBe(true);

    const currentPlan = memory.getCurrentPlan(480);
    expect(currentPlan?.planItems[0].status).toBe('active');
  });
});
