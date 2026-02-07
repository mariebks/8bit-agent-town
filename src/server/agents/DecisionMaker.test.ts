import { describe, expect, test } from 'vitest';
import { AgentManager } from './AgentManager';
import { Agent } from './Agent';
import { DecisionMaker } from './DecisionMaker';
import { MemoryStream } from '../memory/MemoryStream';
import { RequestQueue } from '../llm/RequestQueue';
import { OllamaClient } from '../llm/OllamaClient';
import { NavGrid } from '../world/NavGrid';
import { Pathfinding } from '../world/Pathfinding';
import { Town } from '../world/Town';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

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

  test('records llm prompt/response trace for llm-enabled agents', async () => {
    const agent = createAgent('agent-2');
    const manager = new AgentManager([agent]);
    const memory = new MemoryStream(agent.id);
    const town = createTown();
    const nav = new NavGrid(Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)));
    const pathfinding = new Pathfinding(nav);
    const decisionMaker = new DecisionMaker(21, { llmEnabledAgents: 1, minDecisionIntervalTicks: 1, maxDecisionIntervalTicks: 1 });
    const llmQueue = new RequestQueue({ concurrency: 1 });

    const llmClient = {
      async generate() {
        return {
          success: true,
          content: '{"action":"WAIT","reason":"rest","urgency":5}',
          latencyMs: 1,
          retries: 0,
        };
      },
    } as unknown as OllamaClient;

    decisionMaker.update({
      tickId: 2,
      gameTime: { day: 0, hour: 8, minute: 10, totalMinutes: 490 },
      agentManager: manager,
      pathfinding,
      walkableWaypoints: [{ tileX: 10, tileY: 10 }],
      town,
      llmClient,
      llmQueue,
      memoryByAgent: new Map([[agent.id, memory]]),
    });

    await llmQueue.onIdle();

    const trace = decisionMaker.getLlmTrace(agent.id);
    expect(trace?.lastPrompt).toBeTruthy();
    expect(trace?.lastOutcome).toBe('ok');
    expect(trace?.lastResponse).toContain('"action":"WAIT"');
  });

  test('throttles llm enqueues when queue backpressure is elevated', async () => {
    const firstAgent = createAgent('agent-elevated-1');
    const secondAgent = createAgent('agent-elevated-2', { tileX: 4, tileY: 3 });
    const manager = new AgentManager([firstAgent, secondAgent]);
    const town = createTown();
    const nav = new NavGrid(Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)));
    const pathfinding = new Pathfinding(nav);
    const decisionMaker = new DecisionMaker(33, { llmEnabledAgents: 2, minDecisionIntervalTicks: 1, maxDecisionIntervalTicks: 1 });
    const llmQueue = new RequestQueue({ concurrency: 1, elevatedThreshold: 1, criticalThreshold: 10 });
    const gate = createDeferred<number>();

    let generateCalls = 0;
    const llmClient = {
      async generate() {
        generateCalls += 1;
        return {
          success: true,
          content: '{"action":"WAIT","reason":"rest","urgency":5}',
          latencyMs: 1,
          retries: 0,
        };
      },
    } as unknown as OllamaClient;

    void llmQueue.enqueue({
      id: 'preload-elevated',
      priority: 1,
      ttlMs: 10_000,
      execute: async () => gate.promise,
    });

    await Promise.resolve();
    expect(llmQueue.getBackpressureLevel()).toBe('elevated');

    decisionMaker.update({
      tickId: 3,
      gameTime: { day: 0, hour: 8, minute: 20, totalMinutes: 500 },
      agentManager: manager,
      pathfinding,
      walkableWaypoints: [{ tileX: 10, tileY: 10 }],
      town,
      llmClient,
      llmQueue,
      memoryByAgent: new Map(),
    });

    gate.resolve(1);
    await llmQueue.onIdle();

    expect(generateCalls).toBe(1);
  });

  test('falls back to rule decisions when queue backpressure is critical', async () => {
    const agent = createAgent('agent-critical');
    const manager = new AgentManager([agent]);
    const town = createTown();
    const nav = new NavGrid(Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)));
    const pathfinding = new Pathfinding(nav);
    const decisionMaker = new DecisionMaker(47, { llmEnabledAgents: 1, minDecisionIntervalTicks: 2, maxDecisionIntervalTicks: 2 });
    const llmQueue = new RequestQueue({ concurrency: 1, elevatedThreshold: 1, criticalThreshold: 2 });
    const gate = createDeferred<number>();

    let generateCalls = 0;
    const llmClient = {
      async generate() {
        generateCalls += 1;
        return {
          success: true,
          content: '{"action":"WAIT","reason":"rest","urgency":5}',
          latencyMs: 1,
          retries: 0,
        };
      },
    } as unknown as OllamaClient;

    void llmQueue.enqueue({
      id: 'preload-critical-1',
      priority: 1,
      ttlMs: 10_000,
      execute: async () => gate.promise,
    });
    void llmQueue.enqueue({
      id: 'preload-critical-2',
      priority: 1,
      ttlMs: 10_000,
      execute: async () => 2,
    });

    await Promise.resolve();
    expect(llmQueue.getBackpressureLevel()).toBe('critical');

    decisionMaker.update({
      tickId: 1,
      gameTime: { day: 0, hour: 8, minute: 0, totalMinutes: 480 },
      agentManager: manager,
      pathfinding,
      walkableWaypoints: [{ tileX: 10, tileY: 10 }],
      town,
      llmClient,
      llmQueue,
      memoryByAgent: new Map(),
    });

    expect(agent.hasActivePath()).toBe(true);
    expect(agent.getNextDecisionTick()).toBe(5);

    gate.resolve(1);
    await llmQueue.onIdle();
    expect(generateCalls).toBe(0);
  });
});
