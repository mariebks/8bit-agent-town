import { AgentData, GameTime, SimulationMetrics } from '@shared/Types';
import { UiDensity } from './UiDensity';
import { UiMode } from './UiMode';

export interface UISimulationState {
  connected: boolean;
  tickId: number;
  gameTime: GameTime | null;
  metrics: SimulationMetrics | null;
  agents: AgentData[];
  events: unknown[];
  uiMode: UiMode;
  uiDensity: UiDensity;
  selectedAgentId?: string | null;
  manualSelectionMade?: boolean;
  followSelected?: boolean;
  autoDirectorEnabled?: boolean;
  audioEnabled?: boolean;
  lastJumpedAgentId?: string | null;
}

export interface UIPanel {
  id: string;
  element: HTMLElement;
  show(): void;
  hide(): void;
  update(state: UISimulationState): void;
  destroy(): void;
}
