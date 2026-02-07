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
