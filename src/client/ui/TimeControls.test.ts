import { describe, expect, test } from 'vitest';
import { AgentState } from '@shared/Types';
import { buildTimeControlsBaseStatus } from './TimeControls';
import { UISimulationState } from './types';

function makeState(overrides: Partial<UISimulationState> = {}): UISimulationState {
  return {
    connected: true,
    tickId: 42,
    gameTime: { day: 2, hour: 7, minute: 5, totalMinutes: 2 * 24 * 60 + 7 * 60 + 5 },
    metrics: null,
    agents: [],
    events: [],
    uiMode: 'story',
    uiDensity: 'compact',
    selectedAgentId: null,
    ...overrides,
  };
}

describe('buildTimeControlsBaseStatus', () => {
  test('includes selected none when nothing is selected', () => {
    const status = buildTimeControlsBaseStatus(makeState());
    expect(status).toContain('Day 2 07:05');
    expect(status).toContain('tick 42');
    expect(status).toContain('online');
    expect(status).toContain('selected none');
  });

  test('includes selected agent name and occupation when available', () => {
    const status = buildTimeControlsBaseStatus(
      makeState({
        selectedAgentId: 'agent-1',
        agents: [
          {
            id: 'agent-1',
            name: 'Aria',
            occupation: 'Librarian',
            color: 0x22aa77,
            state: AgentState.Idle,
            position: { x: 0, y: 0 },
            tilePosition: { tileX: 0, tileY: 0 },
          },
        ],
      }),
    );
    expect(status).toContain('selected Aria (Librarian)');
  });
});
