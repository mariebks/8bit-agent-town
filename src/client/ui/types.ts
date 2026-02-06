import { AgentData, GameTime, SimulationMetrics } from '@shared/Types';

export interface UISimulationState {
  connected: boolean;
  tickId: number;
  gameTime: GameTime | null;
  metrics: SimulationMetrics | null;
  agents: AgentData[];
  events: unknown[];
}

export interface UIPanel {
  id: string;
  element: HTMLElement;
  show(): void;
  hide(): void;
  update(state: UISimulationState): void;
  destroy(): void;
}
