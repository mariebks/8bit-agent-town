import { describe, expect, test } from 'vitest';
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

describe('Simulation', () => {
  test('produces snapshots and deltas with agents and metrics', () => {
    const simulation = new Simulation(createMap(), { seed: 7, agentCount: 5, llmEnabled: false });

    simulation.tick(1);
    const snapshot = simulation.createSnapshotEvent(1);

    expect(snapshot.type).toBe('snapshot');
    expect(snapshot.tickId).toBe(1);
    expect(snapshot.agents).toHaveLength(5);
    expect(snapshot.agents[0].currentLocationId).toBe('home_1');
    expect(snapshot.agents[0].currentGoal).toBeTruthy();
    expect(snapshot.agents[0].currentPlan?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot.agents[0].relationshipSummary).toBeDefined();
    expect(snapshot.metrics?.tickDurationMsP50).toBeGreaterThanOrEqual(0);

    simulation.tick(2);
    const delta = simulation.createDeltaEvent(2);

    expect(delta.type).toBe('delta');
    expect(delta.tickId).toBe(2);
    expect(delta.agents).toHaveLength(5);
  });

  test('applies pause/resume and speed controls', () => {
    const simulation = new Simulation(createMap(), { seed: 11, agentCount: 2, llmEnabled: false });
    const firstAgent = simulation.agentManager.getAll()[0];
    const startTile = firstAgent.getTilePosition();

    firstAgent.setPath([{ tileX: startTile.tileX + 1, tileY: startTile.tileY }]);
    const initial = simulation.timeManager.getGameTime().totalMinutes;
    const beforePause = firstAgent.toAgentData();

    expect(simulation.applyControl({ type: 'control', action: 'pause' })).toBe(true);
    simulation.tick(1);
    expect(simulation.timeManager.getGameTime().totalMinutes).toBe(initial);

    const whilePaused = firstAgent.toAgentData();
    expect(whilePaused.position).toEqual(beforePause.position);
    expect(whilePaused.tilePosition).toEqual(beforePause.tilePosition);
    expect(whilePaused.hunger).toBe(beforePause.hunger);
    expect(whilePaused.energy).toBe(beforePause.energy);

    expect(simulation.applyControl({ type: 'control', action: 'resume' })).toBe(true);
    expect(simulation.applyControl({ type: 'control', action: 'setSpeed', value: 4 })).toBe(true);
    simulation.tick(2);

    expect(simulation.timeManager.getGameTime().totalMinutes).toBe(initial + 4);

    const afterResume = firstAgent.toAgentData();
    expect(afterResume.position).not.toEqual(beforePause.position);
    expect(afterResume.hunger).toBeGreaterThan(beforePause.hunger ?? 0);
    expect(afterResume.energy).toBeLessThan(beforePause.energy ?? 100);

    expect(simulation.applyControl({ type: 'control', action: 'setSpeed', value: 3 })).toBe(false);
  });
});
