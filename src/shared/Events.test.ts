import { describe, expect, test } from 'vitest';
import {
  ClientEventSchema,
  ControlAckEventSchema,
  JoinAckEventSchema,
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
});
