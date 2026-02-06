import { UIPanel, UISimulationState } from './types';

interface LogEntry {
  id: string;
  text: string;
}

function summarizeEvent(event: unknown): string {
  if (!event || typeof event !== 'object') {
    return String(event);
  }

  const typed = event as Record<string, unknown>;
  const type = typeof typed.type === 'string' ? typed.type : 'event';

  if (type === 'conversationTurn') {
    return `${type}: ${String(typed.speakerId ?? 'agent')} -> ${String(typed.message ?? '')}`;
  }

  if (type === 'log') {
    return `log/${String(typed.level ?? 'info')}: ${String(typed.message ?? '')}`;
  }

  return `${type}`;
}

export class LogPanel implements UIPanel {
  readonly id = 'log-panel';
  readonly element: HTMLElement;

  private readonly listElement: HTMLElement;
  private readonly statsElement: HTMLElement;
  private readonly entries: LogEntry[] = [];
  private maxEntries = 300;

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel log-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Event Log';

    this.listElement = document.createElement('div');
    this.listElement.className = 'log-list';

    this.statsElement = document.createElement('div');
    this.statsElement.className = 'panel-footer';

    this.element.append(header, this.listElement, this.statsElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    if (state.events.length > 0) {
      for (const event of state.events) {
        this.entries.push({
          id: `${state.tickId}-${this.entries.length + 1}`,
          text: summarizeEvent(event),
        });
      }

      if (this.entries.length > this.maxEntries) {
        this.entries.splice(0, this.entries.length - this.maxEntries);
      }

      this.render();
    }

    this.statsElement.textContent = `entries: ${this.entries.length} | connected: ${state.connected ? 'yes' : 'no'} | tick: ${state.tickId}`;
  }

  destroy(): void {
    this.element.remove();
  }

  private render(): void {
    this.listElement.innerHTML = '';
    const recent = this.entries.slice(Math.max(0, this.entries.length - 16));

    for (const entry of recent) {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = entry.text;
      this.listElement.appendChild(line);
    }

    this.listElement.scrollTop = this.listElement.scrollHeight;
  }
}
