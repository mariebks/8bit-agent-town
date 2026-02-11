import { describe, expect, test } from 'vitest';
import { defaultAgentFinderStatus, resolveAgentFinderStatus } from './AgentFinderStatus';

describe('AgentFinderStatus', () => {
  test('returns default status text from match counts', () => {
    expect(defaultAgentFinderStatus(0)).toBe('type to search');
    expect(defaultAgentFinderStatus(1)).toBe('1 match');
    expect(defaultAgentFinderStatus(3)).toBe('3 matches');
  });

  test('keeps override message until it expires', () => {
    const active = resolveAgentFinderStatus(4, { message: 'focused Alex', expiresAtMs: 2000 }, 1500);
    expect(active.message).toBe('focused Alex');
    expect(active.nextOverride).not.toBeNull();

    const expired = resolveAgentFinderStatus(4, { message: 'focused Alex', expiresAtMs: 2000 }, 2500);
    expect(expired.message).toBe('4 matches');
    expect(expired.nextOverride).toBeNull();
  });
});
