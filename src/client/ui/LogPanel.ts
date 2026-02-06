import { UIPanel, UISimulationState } from './types';

interface LogEntry {
  id: string;
  tickId: number;
  text: string;
  event: unknown;
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

    const headerRow = document.createElement('div');
    headerRow.className = 'panel-header-row';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Event Log';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'ui-btn ui-btn-ghost';
    exportButton.textContent = 'Export JSON';
    exportButton.addEventListener('click', () => this.exportToJson());

    headerRow.append(header, exportButton);

    this.listElement = document.createElement('div');
    this.listElement.className = 'log-list';

    this.statsElement = document.createElement('div');
    this.statsElement.className = 'panel-footer';

    this.element.append(headerRow, this.listElement, this.statsElement);
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
          tickId: state.tickId,
          text: summarizeEvent(event),
          event,
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

  private exportToJson(): void {
    const payload = this.entries.map((entry) => ({
      id: entry.id,
      tickId: entry.tickId,
      text: entry.text,
      event: entry.event,
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-town-events-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
