import { UIPanel, UISimulationState } from './types';
import { UiDensity } from './UiDensity';
import { UiMode } from './UiMode';

interface ModeSwitcherPanelOptions {
  getMode: () => UiMode;
  getDensity: () => UiDensity;
  onModeChange: (mode: UiMode) => void;
  onDensityChange: (density: UiDensity) => void;
  onResetPanels?: () => void;
  onToggleShortcutHelp?: () => boolean;
  getShortcutHelpVisible?: () => boolean;
}

const MODE_LABELS: Record<UiMode, string> = {
  spectator: 'Spectator (M)',
  story: 'Story (M)',
  debug: 'Debug (M)',
};

export class ModeSwitcherPanel implements UIPanel {
  readonly id = 'mode-switcher';
  readonly element: HTMLElement;

  private readonly modeButtons = new Map<UiMode, HTMLButtonElement>();
  private readonly densityButtons = new Map<UiDensity, HTMLButtonElement>();
  private readonly statusElement: HTMLElement;
  private readonly shortcutHelpButton: HTMLButtonElement | null;
  private readonly getMode: () => UiMode;
  private readonly getDensity: () => UiDensity;
  private readonly getShortcutHelpVisible?: () => boolean;

  constructor(options: ModeSwitcherPanelOptions) {
    this.getMode = options.getMode;
    this.getDensity = options.getDensity;
    this.getShortcutHelpVisible = options.getShortcutHelpVisible;
    this.shortcutHelpButton = null;

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
      this.modeButtons.set(mode, button);
      row.append(button);
    }

    const densityRow = document.createElement('div');
    densityRow.className = 'time-controls-row';
    const densityLabel = document.createElement('span');
    densityLabel.className = 'panel-subheader';
    densityLabel.textContent = 'UI Density (N)';
    densityRow.append(densityLabel);

    for (const density of ['full', 'compact'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-btn ui-btn-ghost';
      button.textContent = density === 'full' ? 'Full' : 'Compact';
      button.addEventListener('click', () => {
        options.onDensityChange(density);
        this.renderActiveDensity();
      });
      this.densityButtons.set(density, button);
      densityRow.append(button);
    }

    const utilityRow = document.createElement('div');
    utilityRow.className = 'time-controls-row';
    if (options.onToggleShortcutHelp) {
      const shortcutButton = document.createElement('button');
      shortcutButton.type = 'button';
      shortcutButton.className = 'ui-btn ui-btn-ghost';
      shortcutButton.textContent = 'Shortcuts (?)';
      shortcutButton.addEventListener('click', () => {
        const visible = options.onToggleShortcutHelp?.() ?? false;
        shortcutButton.classList.toggle('active', visible);
      });
      this.shortcutHelpButton = shortcutButton;
      utilityRow.append(shortcutButton);
    }

    if (options.onResetPanels) {
      const resetPanelsButton = document.createElement('button');
      resetPanelsButton.type = 'button';
      resetPanelsButton.className = 'ui-btn ui-btn-ghost';
      resetPanelsButton.textContent = 'Reset Panels';
      resetPanelsButton.addEventListener('click', () => {
        options.onResetPanels?.();
        this.renderShortcutHelpState();
      });
      utilityRow.append(resetPanelsButton);
    }

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, row, densityRow, utilityRow, this.statusElement);
    this.renderActiveMode();
    this.renderActiveDensity();
    this.renderShortcutHelpState();
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    this.renderActiveMode();
    this.renderActiveDensity();
    this.renderShortcutHelpState();
    const time = state.gameTime
      ? `Day ${state.gameTime.day} ${String(state.gameTime.hour).padStart(2, '0')}:${String(state.gameTime.minute).padStart(2, '0')}`
      : 'No server time';
    this.statusElement.textContent = `${time} | ${state.connected ? 'online' : 'offline'} | tick ${state.tickId} | ${
      this.getDensity() === 'compact' ? 'compact UI' : 'full UI'
    }`;
  }

  destroy(): void {
    this.element.remove();
  }

  private renderActiveMode(): void {
    const activeMode = this.getMode();
    for (const [mode, button] of this.modeButtons.entries()) {
      button.classList.toggle('active', mode === activeMode);
    }
  }

  private renderActiveDensity(): void {
    const activeDensity = this.getDensity();
    for (const [density, button] of this.densityButtons.entries()) {
      button.classList.toggle('active', density === activeDensity);
    }
  }

  private renderShortcutHelpState(): void {
    if (!this.shortcutHelpButton || !this.getShortcutHelpVisible) {
      return;
    }
    this.shortcutHelpButton.classList.toggle('active', this.getShortcutHelpVisible());
  }
}
