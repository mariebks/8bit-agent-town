import { AgentState } from '@shared/Types';
import { describe, expect, test } from 'vitest';
import { buildHighlightsReel, HighlightsEntry } from './HighlightsReel';

function entry(overrides: Partial<HighlightsEntry> = {}): HighlightsEntry {
  return {
    id: 'entry',
    tickId: 100,
    gameMinute: 100,
    kind: 'conversation',
    headline: 'Agents started talking',
    actorIds: ['a1', 'a2'],
    agentId: 'a1',
    ...overrides,
  };
}

function agent(id: string, name: string) {
  return {
    id,
    name,
    position: { x: 0, y: 0 },
    tilePosition: { tileX: 0, tileY: 0 },
    state: AgentState.Idle,
    color: 0xffffff,
  };
}

describe('HighlightsReel', () => {
  test('returns empty-state summary when no recent events exist', () => {
    const reel = buildHighlightsReel([], [], 100);
    expect(reel.eventCount).toBe(0);
    expect(reel.bullets).toEqual([]);
    expect(reel.topAgentId).toBeNull();
    expect(reel.summary).toContain('No major moments');
  });

  test('summarizes recent events and spotlight agent', () => {
    const reel = buildHighlightsReel(
      [
        entry({ id: 'c1', tickId: 140, kind: 'conversation', headline: 'A and B started talking', agentId: 'a1' }),
        entry({ id: 'r1', tickId: 145, kind: 'relationship', headline: 'A now sees C as rival', agentId: 'a1' }),
        entry({ id: 't1', tickId: 148, kind: 'topic', headline: 'A shared market gossip', agentId: 'a1' }),
      ],
      [agent('a1', 'Ada')],
      150,
      60,
    );

    expect(reel.eventCount).toBe(3);
    expect(reel.summary).toContain('Last hour:');
    expect(reel.summary).toContain('Spotlight: Ada');
    expect(reel.topAgentId).toBe('a1');
    expect(reel.bullets.length).toBe(3);
  });

  test('drops events outside the configured window', () => {
    const reel = buildHighlightsReel(
      [
        entry({ id: 'old', tickId: 20, gameMinute: 20, kind: 'conversation' }),
        entry({ id: 'new', tickId: 99, gameMinute: 99, kind: 'plan' }),
      ],
      [agent('a1', 'Ada')],
      100,
      10,
    );
    expect(reel.eventCount).toBe(1);
    expect(reel.bullets).toEqual(['Agents started talking']);
  });

  test('uses game-minute windows when available', () => {
    const reel = buildHighlightsReel(
      [
        entry({ id: 'old-minute', tickId: 149, gameMinute: 80, kind: 'relationship', headline: 'old relationship' }),
        entry({ id: 'new-minute', tickId: 140, gameMinute: 160, kind: 'topic', headline: 'fresh topic' }),
      ],
      [agent('a1', 'Ada')],
      150,
      60,
      180,
      60,
    );

    expect(reel.eventCount).toBe(1);
    expect(reel.bullets).toEqual(['fresh topic']);
  });
});
