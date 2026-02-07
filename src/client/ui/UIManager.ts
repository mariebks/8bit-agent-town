import { UIEventBus } from './UIEventBus';
import { UIPanel, UISimulationState } from './types';
import { DEFAULT_UI_MODE, UiMode, loadStoredUiMode, storeUiMode } from './UiMode';

interface PanelRegistration {
  panel: UIPanel;
  visibleIn: Set<UiMode>;
  updateEvery: Record<UiMode, number>;
}

export interface PanelRegistrationOptions {
  visibleIn?: UiMode[];
  updateEvery?: Partial<Record<UiMode, number>>;
}

const ALL_MODES: UiMode[] = ['cinematic', 'story', 'debug'];

export class UIManager {
  private readonly panels = new Map<string, PanelRegistration>();
  private readonly panelVisibility = new Map<string, boolean>();
  private readonly container: HTMLElement;
  private readonly eventBus: UIEventBus;
  private updatePass = 0;
  private mode: UiMode;

  constructor(eventBus: UIEventBus) {
    this.eventBus = eventBus;
    this.container = document.createElement('div');
    this.container.id = 'ui-overlay';
    this.container.className = 'ui-overlay';
    document.body.appendChild(this.container);

    this.mode = loadStoredUiMode(resolveStorage());
    this.applyModeDataset();
  }

  registerPanel(panel: UIPanel, options: PanelRegistrationOptions = {}): void {
    const visibleIn = new Set(options.visibleIn && options.visibleIn.length > 0 ? options.visibleIn : ALL_MODES);
    const updateEvery: Record<UiMode, number> = {
      cinematic: normalizeStride(options.updateEvery?.cinematic),
      story: normalizeStride(options.updateEvery?.story),
      debug: normalizeStride(options.updateEvery?.debug),
    };

    this.panels.set(panel.id, {
      panel,
      visibleIn,
      updateEvery,
    });
    this.panelVisibility.set(panel.id, true);
    this.container.appendChild(panel.element);
    this.applyPanelVisibility(panel.id);
  }

  getEventBus(): UIEventBus {
    return this.eventBus;
  }

  getMode(): UiMode {
    return this.mode;
  }

  setMode(mode: UiMode): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.applyModeDataset();
    storeUiMode(mode, resolveStorage());

    for (const panelId of this.panels.keys()) {
      this.applyPanelVisibility(panelId);
    }

    this.eventBus.emit('ui:modeChanged', mode);
  }

  updateAll(state: UISimulationState): void {
    this.updatePass += 1;

    for (const registration of this.panels.values()) {
      const stride = registration.updateEvery[this.mode];
      if (this.updatePass % stride !== 0) {
        continue;
      }
      registration.panel.update(state);
    }
  }

  togglePanel(panelId: string): boolean {
    const current = this.panelVisibility.get(panelId) ?? true;
    this.setPanelVisible(panelId, !current);
    return this.isPanelVisible(panelId);
  }

  setPanelVisible(panelId: string, visible: boolean): void {
    if (!this.panels.has(panelId)) {
      return;
    }

    this.panelVisibility.set(panelId, visible);
    this.applyPanelVisibility(panelId);
  }

  isPanelVisible(panelId: string): boolean {
    const registration = this.panels.get(panelId);
    if (!registration) {
      return false;
    }

    const userVisible = this.panelVisibility.get(panelId) ?? true;
    const modeVisible = registration.visibleIn.has(this.mode);
    return userVisible && modeVisible;
  }

  destroy(): void {
    for (const registration of this.panels.values()) {
      registration.panel.destroy();
    }
    this.panels.clear();
    this.container.remove();
  }

  private applyPanelVisibility(panelId: string): void {
    const registration = this.panels.get(panelId);
    if (!registration) {
      return;
    }

    if (this.isPanelVisible(panelId)) {
      registration.panel.show();
      return;
    }

    registration.panel.hide();
  }

  private applyModeDataset(): void {
    document.body.dataset.uiMode = this.mode;
  }
}

function normalizeStride(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function resolveStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage ?? null;
}

export function normalizeUiMode(value: unknown): UiMode {
  if (value === 'story' || value === 'debug') {
    return value;
  }
  return DEFAULT_UI_MODE;
}
