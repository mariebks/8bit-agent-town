import { AgentData, GameTime } from '@shared/Types';

export interface UISimulationState {
  connected: boolean;
  tickId: number;
  gameTime: GameTime | null;
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
