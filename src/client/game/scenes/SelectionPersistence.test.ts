import { describe, expect, test } from 'vitest';
import {
  loadPreferredSelectedAgentId,
  resolveSelectedAgentId,
  storePreferredSelectedAgentId,
} from './SelectionPersistence';

describe('SelectionPersistence', () => {
  test('loads and stores preferred selected agent id', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    expect(loadPreferredSelectedAgentId(adapter)).toBeNull();
    storePreferredSelectedAgentId('agent-2', adapter);
    expect(loadPreferredSelectedAgentId(adapter)).toBe('agent-2');
    storePreferredSelectedAgentId(null, adapter);
    expect(loadPreferredSelectedAgentId(adapter)).toBeNull();
  });

  test('keeps current selection when still active', () => {
    const selected = resolveSelectedAgentId({
      currentSelectedAgentId: 'agent-2',
      preferredSelectedAgentId: 'agent-1',
      activeAgentIds: new Set(['agent-1', 'agent-2']),
      serverSelectionInitialized: true,
      manualSelectionMade: true,
      mostActiveAgentId: 'agent-1',
      firstAgentId: 'agent-1',
    });

    expect(selected).toBe('agent-2');
  });

  test('restores preferred selection when current agent disappeared', () => {
    const selected = resolveSelectedAgentId({
      currentSelectedAgentId: 'agent-9',
      preferredSelectedAgentId: 'agent-3',
      activeAgentIds: new Set(['agent-1', 'agent-3']),
      serverSelectionInitialized: true,
      manualSelectionMade: true,
      mostActiveAgentId: 'agent-1',
      firstAgentId: 'agent-1',
    });

    expect(selected).toBe('agent-3');
  });

  test('uses most active agent before initialization when manual selection was not made', () => {
    const selected = resolveSelectedAgentId({
      currentSelectedAgentId: null,
      preferredSelectedAgentId: null,
      activeAgentIds: new Set(['agent-1', 'agent-2']),
      serverSelectionInitialized: false,
      manualSelectionMade: false,
      mostActiveAgentId: 'agent-2',
      firstAgentId: 'agent-1',
    });

    expect(selected).toBe('agent-2');
  });

  test('uses first agent before initialization when manual selection was made', () => {
    const selected = resolveSelectedAgentId({
      currentSelectedAgentId: null,
      preferredSelectedAgentId: null,
      activeAgentIds: new Set(['agent-1', 'agent-2']),
      serverSelectionInitialized: false,
      manualSelectionMade: true,
      mostActiveAgentId: 'agent-2',
      firstAgentId: 'agent-1',
    });

    expect(selected).toBe('agent-1');
  });

  test('keeps no selection after initialization when no active preferred option remains', () => {
    const selected = resolveSelectedAgentId({
      currentSelectedAgentId: null,
      preferredSelectedAgentId: 'agent-9',
      activeAgentIds: new Set(['agent-1', 'agent-2']),
      serverSelectionInitialized: true,
      manualSelectionMade: false,
      mostActiveAgentId: 'agent-2',
      firstAgentId: 'agent-1',
    });

    expect(selected).toBeNull();
  });
});
