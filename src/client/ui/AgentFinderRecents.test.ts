import { describe, expect, test } from 'vitest';
import { loadRecentAgentIds, pushRecentAgentId } from './AgentFinderRecents';

describe('AgentFinderRecents', () => {
  test('pushes focused agent to front with dedupe and cap', () => {
    expect(pushRecentAgentId(['a1', 'a2', 'a3'], 'a2', 3)).toEqual(['a2', 'a1', 'a3']);
    expect(pushRecentAgentId(['a1', 'a2', 'a3'], 'a4', 3)).toEqual(['a4', 'a1', 'a2']);
  });

  test('loads recent ids defensively from storage', () => {
    const storage = {
      getItem: () => '["a3","a1","a2", 4, null]',
      setItem: () => undefined,
    };
    expect(loadRecentAgentIds(storage, 3)).toEqual(['a3', 'a1', 'a2']);
  });
});
