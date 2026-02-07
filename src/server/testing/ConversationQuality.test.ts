import { describe, expect, test } from 'vitest';
import { ConversationTurnEvent } from '@shared/Events';
import { AgentState } from '@shared/Types';
import { scoreConversationQuality } from './ConversationQuality';

function turn(conversationId: string, speakerId: string, message: string): ConversationTurnEvent {
  return {
    type: 'conversationTurn',
    conversationId,
    speakerId,
    message,
    gameTime: { day: 0, hour: 9, minute: 0, totalMinutes: 540 },
  };
}

describe('ConversationQuality', () => {
  test('returns zeroed metrics when no turns are present', () => {
    const metrics = scoreConversationQuality([], []);
    expect(metrics.totalTurns).toBe(0);
    expect(metrics.conversationCount).toBe(0);
    expect(metrics.topicalityScore).toBe(0);
  });

  test('scores topicality, repetition, and memory references', () => {
    const turns = [
      turn('c1', 'a1', 'Glad you are here, about market prices: I noticed fresh goods today.'),
      turn('c1', 'a2', 'Market prices still matter. I noticed supply changes too.'),
      turn('c1', 'a1', 'Market prices still matter. I noticed supply changes too.'),
      turn('c2', 'a2', 'Honestly, weather shifts are a problem for transport.'),
    ];

    const metrics = scoreConversationQuality(turns, [
      {
        id: 'a1',
        name: 'Alex',
        state: AgentState.Idle,
        position: { x: 0, y: 0 },
        tilePosition: { tileX: 0, tileY: 0 },
        color: 1,
        relationshipSummary: {
          friendCount: 1,
          rivalCount: 0,
          averageWeight: 42,
        },
      },
      {
        id: 'a2',
        name: 'Blair',
        state: AgentState.Idle,
        position: { x: 0, y: 0 },
        tilePosition: { tileX: 1, tileY: 1 },
        color: 2,
        relationshipSummary: {
          friendCount: 0,
          rivalCount: 0,
          averageWeight: -8,
        },
      },
    ]);

    expect(metrics.totalTurns).toBe(4);
    expect(metrics.conversationCount).toBe(2);
    expect(metrics.topicalityScore).toBeGreaterThan(0.45);
    expect(metrics.repetitionRate).toBeGreaterThan(0);
    expect(metrics.memoryReferenceRate).toBeGreaterThan(0);
    expect(metrics.uniqueTurnRatio).toBeLessThan(1);
    expect(metrics.relationshipConsistencyScore).toBeGreaterThan(0);
  });
});
