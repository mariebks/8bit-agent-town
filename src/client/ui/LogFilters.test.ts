import { describe, expect, test } from 'vitest';
import { filterLogEntries, parseLogEvent } from './LogFilters';

describe('LogFilters', () => {
  test('parses conversation events with speaker as agent id', () => {
    const parsed = parseLogEvent({
      type: 'conversationTurn',
      speakerId: 'agent-2',
      message: 'hello',
    });

    expect(parsed.type).toBe('conversationTurn');
    expect(parsed.agentId).toBe('agent-2');
    expect(parsed.text).toContain('agent-2');
  });

  test('parses log events and keeps explicit agent id', () => {
    const parsed = parseLogEvent({
      type: 'log',
      level: 'warn',
      agentId: 'agent-7',
      message: 'fallback used',
    });

    expect(parsed.type).toBe('log');
    expect(parsed.agentId).toBe('agent-7');
    expect(parsed.text).toContain('fallback used');
  });

  test('parses relationship and arrival events with agent context', () => {
    const relationship = parseLogEvent({
      type: 'relationshipShift',
      sourceId: 'agent-3',
      targetId: 'agent-4',
      stance: 'friend',
    });
    expect(relationship.agentId).toBe('agent-3');
    expect(relationship.text).toContain('friend');

    const arrival = parseLogEvent({
      type: 'locationArrival',
      agentId: 'agent-9',
      locationId: 'market',
    });
    expect(arrival.agentId).toBe('agent-9');
    expect(arrival.text).toContain('market');

    const topicSpread = parseLogEvent({
      type: 'topicSpread',
      sourceId: 'agent-9',
      targetId: 'agent-3',
      topic: 'weather',
    });
    expect(topicSpread.agentId).toBe('agent-9');
    expect(topicSpread.text).toContain('weather');
  });

  test('filters by type and partial agent id', () => {
    const entries = [
      { type: 'log', agentId: 'agent-1' },
      { type: 'speechBubble', agentId: 'agent-2' },
      { type: 'conversationTurn', agentId: 'agent-11' },
    ];

    expect(filterLogEntries(entries, 'all', '')).toHaveLength(3);
    expect(filterLogEntries(entries, 'speechBubble', '')).toHaveLength(1);
    expect(filterLogEntries(entries, 'all', 'agent-1')).toHaveLength(2);
    expect(filterLogEntries(entries, 'conversationTurn', 'agent-11')).toHaveLength(1);
  });
});
