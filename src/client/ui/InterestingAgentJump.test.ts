import { describe, expect, test } from 'vitest';
import { pickFocusableInterestingAgent } from './InterestingAgentJump';

describe('InterestingAgentJump', () => {
  test('returns first focusable candidate', () => {
    const candidates = ['agent-1', 'agent-2'];
    const next = () => candidates.shift() ?? null;
    const focused = pickFocusableInterestingAgent(next, 2, (id) => id === 'agent-1');
    expect(focused).toBe('agent-1');
  });

  test('skips stale candidates until a focusable one is found', () => {
    const candidates = ['stale-1', 'stale-2', 'agent-3'];
    const next = () => candidates.shift() ?? null;
    const focused = pickFocusableInterestingAgent(next, 3, (id) => id === 'agent-3');
    expect(focused).toBe('agent-3');
  });

  test('returns null when no candidate can be focused within queue bounds', () => {
    const candidates = ['stale-1', 'stale-2', 'stale-3'];
    const next = () => candidates.shift() ?? null;
    const focused = pickFocusableInterestingAgent(next, 3, () => false);
    expect(focused).toBeNull();
  });
});

