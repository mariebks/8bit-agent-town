import { UIEventBus } from './UIEventBus';
import { UIPanel, UISimulationState } from './types';

export class UIManager {
  private readonly panels = new Map<string, UIPanel>();
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
    this.container.appendChild(panel.element);
  }

  getEventBus(): UIEventBus {
    return this.eventBus;
  }

  updateAll(state: UISimulationState): void {
    for (const panel of this.panels.values()) {
      panel.update(state);
    }
  }

  destroy(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }
    this.panels.clear();
    this.container.remove();
  }
}
