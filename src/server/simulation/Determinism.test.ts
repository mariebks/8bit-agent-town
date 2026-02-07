import { describe, expect, test } from 'vitest';
import { AgentData } from '@shared/Types';
import { Simulation } from './Simulation';

function createMap(width = 10, height = 10) {
  return {
    width,
    height,
    layers: [
      {
        id: 1,
        name: 'collision',
        type: 'tilelayer',
        data: Array.from({ length: width * height }, () => 0),
      },
    ],
  };
}

function runSimulation(seed: number, ticks: number): { gameTime: number; agents: AgentFingerprint[] } {
  const simulation = new Simulation(createMap(), { seed, agentCount: 8, llmEnabled: false });

  for (let tickId = 1; tickId <= ticks; tickId += 1) {
    simulation.tick(tickId);
  }

  const snapshot = simulation.createSnapshotEvent(ticks);
  return {
    gameTime: snapshot.gameTime.totalMinutes,
    agents: snapshot.agents.map(toFingerprint),
  };
}

function toFingerprint(agent: AgentData): AgentFingerprint {
  return {
    id: agent.id,
    position: agent.position,
    tilePosition: agent.tilePosition,
    state: agent.state,
    currentGoal: agent.currentGoal ?? null,
    currentAction: agent.currentAction ?? null,
    currentPlan: agent.currentPlan ?? [],
    energy: agent.energy ?? null,
    hunger: agent.hunger ?? null,
    mood: agent.mood ?? null,
  };
}

interface AgentFingerprint {
  id: string;
  position: { x: number; y: number };
  tilePosition: { tileX: number; tileY: number };
  state: string;
  currentGoal: string | null;
  currentAction: string | null;
  currentPlan: string[];
  energy: number | null;
  hunger: number | null;
  mood: number | null;
}

describe('Simulation determinism', () => {
  test('same seed produces identical state after fixed ticks', () => {
    const left = runSimulation(12345, 300);
    const right = runSimulation(12345, 300);

    expect(left.gameTime).toBe(right.gameTime);
    expect(left.agents).toEqual(right.agents);
  });

  test('different seeds diverge over fixed ticks', () => {
    const left = runSimulation(12345, 300);
    const right = runSimulation(12346, 300);

    expect(left.agents).not.toEqual(right.agents);
  });
});
