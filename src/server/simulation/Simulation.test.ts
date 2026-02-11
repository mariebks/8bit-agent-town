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
    expect(snapshot.metrics?.llmQueueBackpressure).toBeDefined();
    expect(snapshot.metrics?.llmQueueHealthy).toBeDefined();
    expect(snapshot.metrics?.pathCacheSize).toBeGreaterThanOrEqual(0);
    expect(snapshot.metrics?.pathCacheHitRate).toBeGreaterThanOrEqual(0);

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

  test('trims conversations and applies short cooldown under critical queue pressure', () => {
    const simulation = new Simulation(createMap(20, 20), { seed: 19, agentCount: 8, llmEnabled: false });
    const internals = simulation as unknown as {
      conversationManager: {
        startConversation: (
          leftId: string,
          rightId: string,
          locationId: string,
          gameTime: { totalMinutes: number; day: number; hour: number; minute: number },
          relationshipWeight?: number,
        ) => { conversationId: string } | null;
        getActiveConversations: () => Array<{ turns: Array<{ speakerId: string; message: string; timestamp: number }> }>;
      };
      initializeConversationState: (
        conversationId: string,
        leftId: string,
        rightId: string,
        locationId: string,
        gameTime: { totalMinutes: number; day: number; hour: number; minute: number },
      ) => void;
      trimConversationsForQueuePressure: (gameTime: { totalMinutes: number; day: number; hour: number; minute: number }) => void;
      llmQueue: { getBackpressureLevel: () => string };
      conversationCooldownUntilByAgent: Map<string, number>;
    };

    const gameTime = simulation.timeManager.getGameTime();
    const ids = simulation.agentManager.getAll().map((agent) => agent.id);
    const pairs: Array<[string, string]> = [
      [ids[0], ids[1]],
      [ids[2], ids[3]],
      [ids[4], ids[5]],
    ];

    for (const [leftId, rightId] of pairs) {
      const started = internals.conversationManager.startConversation(leftId, rightId, 'plaza', gameTime, 0);
      expect(started).not.toBeNull();
      internals.initializeConversationState(started!.conversationId, leftId, rightId, 'plaza', gameTime);
    }

    const originalGetBackpressureLevel = internals.llmQueue.getBackpressureLevel;
    internals.llmQueue.getBackpressureLevel = () => 'critical';
    internals.trimConversationsForQueuePressure(gameTime);
    internals.llmQueue.getBackpressureLevel = originalGetBackpressureLevel;

    expect(internals.conversationManager.getActiveConversations()).toHaveLength(2);
    expect(internals.conversationCooldownUntilByAgent.size).toBeGreaterThanOrEqual(2);
    for (const cooldownUntil of internals.conversationCooldownUntilByAgent.values()) {
      expect(cooldownUntil).toBeGreaterThan(gameTime.totalMinutes);
    }
  });

  test('applies rewrite cooldown when a conversation ends from repeated fallback rewrites', () => {
    const simulation = new Simulation(createMap(20, 20), { seed: 23, agentCount: 4, llmEnabled: false });
    const internals = simulation as unknown as {
      conversationManager: {
        startConversation: (
          leftId: string,
          rightId: string,
          locationId: string,
          gameTime: { totalMinutes: number; day: number; hour: number; minute: number },
          relationshipWeight?: number,
        ) => { conversationId: string } | null;
        getActiveConversations: () => Array<{ turns: Array<{ speakerId: string; message: string; timestamp: number }> }>;
      };
      initializeConversationState: (
        conversationId: string,
        leftId: string,
        rightId: string,
        locationId: string,
        gameTime: { totalMinutes: number; day: number; hour: number; minute: number },
      ) => void;
      conversationStateById: Map<string, { rewriteStreak: number; conversationArc: string }>;
      conversationCooldownUntilByAgent: Map<string, number>;
      endConversationsNaturally: (gameTime: { totalMinutes: number; day: number; hour: number; minute: number }) => void;
      isAgentConversationCoolingDown: (agentId: string, gameMinute: number) => boolean;
    };

    const gameTime = simulation.timeManager.getGameTime();
    const ids = simulation.agentManager.getAll().map((agent) => agent.id);
    const leftId = ids[0];
    const rightId = ids[1];

    const started = internals.conversationManager.startConversation(leftId, rightId, 'plaza', gameTime, 0);
    expect(started).not.toBeNull();
    const conversationId = started!.conversationId;
    internals.initializeConversationState(conversationId, leftId, rightId, 'plaza', gameTime);
    const state = internals.conversationStateById.get(conversationId);
    expect(state).toBeDefined();
    state!.rewriteStreak = 3;
    state!.conversationArc = 'closing';
    const activeConversation = internals.conversationManager.getActiveConversations()[0];
    activeConversation.turns.push(
      { speakerId: leftId, message: 'first turn', timestamp: gameTime.totalMinutes },
      { speakerId: rightId, message: 'second turn', timestamp: gameTime.totalMinutes + 1 },
    );

    internals.endConversationsNaturally(gameTime);

    expect(internals.conversationManager.getActiveConversations()).toHaveLength(0);
    const cooldownUntil = internals.conversationCooldownUntilByAgent.get(leftId);
    expect(cooldownUntil).toBeGreaterThan(gameTime.totalMinutes);
    expect(internals.isAgentConversationCoolingDown(leftId, gameTime.totalMinutes)).toBe(true);
    expect(internals.isAgentConversationCoolingDown(leftId, cooldownUntil!)).toBe(false);
  });

  test('emits topic spread events and social provenance memories for nearby overhearing agents', () => {
    const simulation = new Simulation(createMap(20, 20), { seed: 29, agentCount: 5, llmEnabled: false });
    const internals = simulation as unknown as {
      rng: { chance: (value: number) => boolean };
      propagateTopicToNearbyAgents: (
        topic: string,
        speakerId: string,
        listenerId: string,
        gameTime: { totalMinutes: number; day: number; hour: number; minute: number },
      ) => void;
      drainServerEvents: () => Array<{ type: string; topic?: string; sourceId?: string; targetId?: string }>;
      memoryByAgent: Map<
        string,
        {
          retrieveTopK: (
            query: string,
            gameMinute: number,
            maxResults: number,
            keywords?: string[],
          ) => Array<{ memory: { content: string; source: string } }>;
        }
      >;
    };

    const agents = simulation.agentManager.getAll();
    const [speaker, listener, bystander, ...rest] = agents;
    (speaker as unknown as { tilePosition: { tileX: number; tileY: number } }).tilePosition = { tileX: 10, tileY: 10 };
    (listener as unknown as { tilePosition: { tileX: number; tileY: number } }).tilePosition = { tileX: 11, tileY: 10 };
    (bystander as unknown as { tilePosition: { tileX: number; tileY: number } }).tilePosition = { tileX: 11, tileY: 11 };
    for (const farAgent of rest) {
      (farAgent as unknown as { tilePosition: { tileX: number; tileY: number } }).tilePosition = { tileX: 0, tileY: 0 };
    }

    const gameTime = simulation.timeManager.getGameTime();
    const originalChance = internals.rng.chance;
    internals.rng.chance = () => true;
    internals.propagateTopicToNearbyAgents('fishing festival', speaker.id, listener.id, gameTime);
    internals.rng.chance = originalChance;

    const topicEvents = internals.drainServerEvents().filter((event) => event.type === 'topicSpread');
    expect(topicEvents.length).toBeGreaterThan(0);
    expect(topicEvents.some((event) => event.targetId === bystander.id)).toBe(true);

    const bystanderMemories =
      internals.memoryByAgent.get(bystander.id)?.retrieveTopK('fishing festival', gameTime.totalMinutes, 10, ['fishing']) ?? [];
    expect(bystanderMemories.some((item) => item.memory.source === 'social')).toBe(true);
    expect(bystanderMemories.some((item) => item.memory.content.toLowerCase().includes('mentioned fishing festival'))).toBe(
      true,
    );
  });

  test('keeps strongest rival edges when truncating relationship payloads', () => {
    const simulation = new Simulation(createMap(20, 20), { seed: 31, agentCount: 14, llmEnabled: false });
    const internals = simulation as unknown as {
      relationships: {
        applyConversationDelta: (sourceId: string, targetId: string, delta: number, gameTime: number) => void;
      };
    };

    const ids = simulation.agentManager.getAll().map((agent) => agent.id);
    const sourceId = ids[0];
    const positiveTargets = ids.slice(1, 13);
    const strongRivalTarget = ids[13];
    const gameMinute = simulation.timeManager.getGameTime().totalMinutes;

    for (const targetId of positiveTargets) {
      internals.relationships.applyConversationDelta(sourceId, targetId, 10, gameMinute);
    }
    internals.relationships.applyConversationDelta(sourceId, strongRivalTarget, -90, gameMinute);

    const snapshot = simulation.createSnapshotEvent(1);
    const sourceAgent = snapshot.agents.find((agent) => agent.id === sourceId);

    expect(sourceAgent).toBeDefined();
    expect(sourceAgent?.relationshipEdges).toHaveLength(12);
    expect(sourceAgent?.relationshipEdges?.[0]?.targetId).toBe(strongRivalTarget);
    expect(sourceAgent?.relationshipEdges?.some((edge) => edge.targetId === strongRivalTarget)).toBe(true);
    expect(sourceAgent?.relationshipEdges?.filter((edge) => edge.weight > 0)).toHaveLength(11);
  });
});
