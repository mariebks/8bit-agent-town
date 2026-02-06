import { describe, expect, test } from 'vitest';
import { ConversationManager } from './Conversation';

const gameTime = {
  day: 0,
  hour: 9,
  minute: 0,
  totalMinutes: 540,
};

describe('ConversationManager', () => {
  test('starts, advances, and ends conversations by max turns', () => {
    const manager = new ConversationManager({ maxTurns: 2, cooldownMinutes: 1 });

    const start = manager.startConversation('a1', 'a2', 'cafe', gameTime);
    expect(start).not.toBeNull();
    expect(start?.participants).toEqual(['a1', 'a2']);

    const firstTick = manager.tick(gameTime, ({ speakerId }) => `hello from ${speakerId}`);
    expect(firstTick.turnEvents).toHaveLength(1);
    expect(firstTick.endEvents).toHaveLength(0);

    const secondTick = manager.tick({ ...gameTime, totalMinutes: 541 }, ({ speakerId }) => `next from ${speakerId}`);
    expect(secondTick.turnEvents).toHaveLength(1);
    expect(secondTick.endEvents).toHaveLength(1);
    expect(secondTick.endEvents[0].reason).toBe('maxTurns');

    expect(manager.isAgentAvailable('a1')).toBe(true);
    expect(manager.isAgentAvailable('a2')).toBe(true);
  });

  test('respects pair cooldown', () => {
    const manager = new ConversationManager({ cooldownMinutes: 10 });

    manager.startConversation('a1', 'a2', 'plaza', gameTime);
    manager.endConversation('conv-1', 'agentEnded', gameTime);

    const canRestart = manager.canStartConversation('a1', 'a2', gameTime.totalMinutes + 3, 0);
    expect(canRestart).toBe(false);
  });

  test('enforces configured relationship threshold when starting', () => {
    const manager = new ConversationManager({ minRelationshipWeight: 10 });

    const blocked = manager.startConversation('a1', 'a2', 'plaza', gameTime, 5);
    expect(blocked).toBeNull();

    const allowed = manager.startConversation('a1', 'a2', 'plaza', gameTime, 12);
    expect(allowed).not.toBeNull();
  });
});
