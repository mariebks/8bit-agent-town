import { UIEventBus } from './UIEventBus';
import { UIPanel, UISimulationState } from './types';

export class UIManager {
  private readonly panels = new Map<string, UIPanel>();
  private readonly panelVisibility = new Map<string, boolean>();
  private readonly container: HTMLElement;
  private readonly eventBus: UIEventBus;

  constructor(eventBus: UIEventBus) {
    this.eventBus = eventBus;
    this.container = document.createElement('div');
    this.container.id = 'ui-overlay';
    this.container.className = 'ui-overlay';
    document.body.appendChild(this.container);
  }

  registerPanel(panel: UIPanel): void {
    this.panels.set(panel.id, panel);
    this.panelVisibility.set(panel.id, true);
    this.container.appendChild(panel.element);
    panel.show();
  }

  getEventBus(): UIEventBus {
    return this.eventBus;
  }

  updateAll(state: UISimulationState): void {
    for (const panel of this.panels.values()) {
      panel.update(state);
    }
  }

  togglePanel(panelId: string): boolean {
    const current = this.panelVisibility.get(panelId) ?? true;
    this.setPanelVisible(panelId, !current);
    return !current;
  }

  setPanelVisible(panelId: string, visible: boolean): void {
    const panel = this.panels.get(panelId);
    if (!panel) {
      return;
    }

    this.panelVisibility.set(panelId, visible);
    if (visible) {
      panel.show();
      return;
    }
    panel.hide();
  }

  isPanelVisible(panelId: string): boolean {
    return this.panelVisibility.get(panelId) ?? false;
  }

  destroy(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }
    this.panels.clear();
    this.container.remove();
  }
}
