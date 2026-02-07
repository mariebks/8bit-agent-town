import { describe, expect, test } from 'vitest';
import {
  ClientEventSchema,
  ControlAckEventSchema,
  JoinAckEventSchema,
  LocationArrivalEventSchema,
  RelationshipShiftEventSchema,
  TopicSpreadEventSchema,
  SnapshotEventSchema,
  ServerEventSchema,
} from './Events';

describe('Events schemas', () => {
  test('parses join and control client events', () => {
    const join = ClientEventSchema.safeParse({
      type: 'join',
      protocolVersion: 1,
    });
    expect(join.success).toBe(true);

    const control = ClientEventSchema.safeParse({
      type: 'control',
      action: 'setSpeed',
      value: 4,
    });
    expect(control.success).toBe(true);
  });

  test('parses joinAck and controlAck server events', () => {
    const joinAck = JoinAckEventSchema.safeParse({
      type: 'joinAck',
      protocolVersion: 1,
      accepted: true,
      tickId: 12,
    });
    expect(joinAck.success).toBe(true);
    expect(ServerEventSchema.safeParse(joinAck.success ? joinAck.data : null).success).toBe(true);

    const controlAck = ControlAckEventSchema.safeParse({
      type: 'controlAck',
      action: 'pause',
      accepted: false,
      tickId: 12,
      reason: 'join required',
    });
    expect(controlAck.success).toBe(true);
    expect(ServerEventSchema.safeParse(controlAck.success ? controlAck.data : null).success).toBe(true);
  });

  test('parses relationship and arrival server events', () => {
    const relationshipShift = RelationshipShiftEventSchema.safeParse({
      type: 'relationshipShift',
      sourceId: 'agent-1',
      targetId: 'agent-2',
      fromWeight: 59,
      toWeight: 61,
      stance: 'friend',
      gameTime: { day: 0, hour: 9, minute: 0, totalMinutes: 540 },
    });
    expect(relationshipShift.success).toBe(true);
    expect(ServerEventSchema.safeParse(relationshipShift.success ? relationshipShift.data : null).success).toBe(true);

    const arrival = LocationArrivalEventSchema.safeParse({
      type: 'locationArrival',
      agentId: 'agent-1',
      locationId: 'market',
      gameTime: { day: 0, hour: 9, minute: 4, totalMinutes: 544 },
    });
    expect(arrival.success).toBe(true);
    expect(ServerEventSchema.safeParse(arrival.success ? arrival.data : null).success).toBe(true);

    const topicSpread = TopicSpreadEventSchema.safeParse({
      type: 'topicSpread',
      topic: 'market prices',
      sourceId: 'agent-1',
      targetId: 'agent-3',
      confidence: 0.72,
      gameTime: { day: 0, hour: 9, minute: 6, totalMinutes: 546 },
    });
    expect(topicSpread.success).toBe(true);
    expect(ServerEventSchema.safeParse(topicSpread.success ? topicSpread.data : null).success).toBe(true);
  });

  test('parses snapshot with cognition and relationship fields', () => {
    const parsed = SnapshotEventSchema.safeParse({
      type: 'snapshot',
      tickId: 1,
      gameTime: { day: 0, hour: 8, minute: 0, totalMinutes: 480 },
      agents: [
        {
          id: 'agent-1',
          name: 'Alex',
          position: { x: 10, y: 20 },
          tilePosition: { tileX: 1, tileY: 2 },
          state: 'idle',
          color: 12345,
          currentGoal: 'Go to work',
          currentPlan: ['Breakfast', 'Work'],
          lastReflection: 'A thoughtful morning.',
          relationshipSummary: {
            friendCount: 2,
            rivalCount: 0,
            averageWeight: 24.5,
            strongestBondId: 'agent-2',
          },
          llmTrace: {
            lastOutcome: 'ok',
            lastPrompt: 'prompt text',
            lastResponse: 'response text',
            updatedAtTick: 1,
          },
        },
      ],
      events: [],
      metrics: {
        tickDurationMsP50: 4,
        tickDurationMsP95: 8,
        tickDurationMsP99: 10,
        queueDepth: 1,
        queueDropped: 0,
        llmFallbackRate: 0.2,
        llmQueueMaxDepth: 4,
        llmQueueAvgWaitMs: 7,
        llmQueueAvgProcessMs: 12,
        llmQueueBackpressure: 'elevated',
        llmQueueHealthy: true,
        pathCacheSize: 3,
        pathCacheHitRate: 0.25,
      },
    });

    expect(parsed.success).toBe(true);
  });

  test('rejects negative tick ids in ticked server events', () => {
    const negativeSnapshot = SnapshotEventSchema.safeParse({
      type: 'snapshot',
      tickId: -1,
      gameTime: { day: 0, hour: 8, minute: 0, totalMinutes: 480 },
      agents: [],
    });

    expect(negativeSnapshot.success).toBe(false);
  });
});
