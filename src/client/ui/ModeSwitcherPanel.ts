import { UIPanel, UISimulationState } from './types';
import { UiMode } from './UiMode';

interface ModeSwitcherPanelOptions {
  getMode: () => UiMode;
  onModeChange: (mode: UiMode) => void;
}

const MODE_LABELS: Record<UiMode, string> = {
  spectator: 'Spectator',
  story: 'Story',
  debug: 'Debug',
};

export class ModeSwitcherPanel implements UIPanel {
  readonly id = 'mode-switcher';
  readonly element: HTMLElement;

  private readonly buttons = new Map<UiMode, HTMLButtonElement>();
  private readonly statusElement: HTMLElement;
  private readonly getMode: () => UiMode;

  constructor(options: ModeSwitcherPanelOptions) {
    this.getMode = options.getMode;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel mode-switcher-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'View Mode';

    const row = document.createElement('div');
    row.className = 'time-controls-row';

    for (const mode of ['spectator', 'story', 'debug'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-btn ui-btn-ghost';
      button.textContent = MODE_LABELS[mode];
      button.addEventListener('click', () => {
        options.onModeChange(mode);
        this.renderActiveMode();
      });
      this.buttons.set(mode, button);
      row.append(button);
    }

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, row, this.statusElement);
    this.renderActiveMode();
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    this.renderActiveMode();
    const time = state.gameTime
      ? `Day ${state.gameTime.day} ${String(state.gameTime.hour).padStart(2, '0')}:${String(state.gameTime.minute).padStart(2, '0')}`
      : 'No server time';
    this.statusElement.textContent = `${time} | ${state.connected ? 'online' : 'offline'} | tick ${state.tickId}`;
  }

  destroy(): void {
    this.element.remove();
  }

  private renderActiveMode(): void {
    const activeMode = this.getMode();
    for (const [mode, button] of this.buttons.entries()) {
      button.classList.toggle('active', mode === activeMode);
    }
  }
}
