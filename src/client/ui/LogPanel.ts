import { UIPanel, UISimulationState } from './types';
import { filterLogEntries, parseLogEvent } from './LogFilters';

interface LogEntry {
  id: string;
  tickId: number;
  type: string;
  agentId?: string;
  text: string;
  event: unknown;
}

export class LogPanel implements UIPanel {
  readonly id = 'log-panel';
  readonly element: HTMLElement;

  private readonly listElement: HTMLElement;
  private readonly statsElement: HTMLElement;
  private readonly typeFilterSelect: HTMLSelectElement;
  private readonly agentFilterInput: HTMLInputElement;
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

    const filterRow = document.createElement('div');
    filterRow.className = 'time-controls-row';

    this.typeFilterSelect = document.createElement('select');
    this.typeFilterSelect.className = 'ui-select';
    for (const option of ['all', 'log', 'conversationTurn', 'speechBubble', 'conversationStart', 'conversationEnd']) {
      const selectOption = document.createElement('option');
      selectOption.value = option;
      selectOption.textContent = option === 'all' ? 'all events' : option;
      this.typeFilterSelect.appendChild(selectOption);
    }
    this.typeFilterSelect.addEventListener('change', () => this.render());

    this.agentFilterInput = document.createElement('input');
    this.agentFilterInput.className = 'ui-input';
    this.agentFilterInput.type = 'text';
    this.agentFilterInput.placeholder = 'filter agent id';
    this.agentFilterInput.addEventListener('input', () => this.render());

    filterRow.append(this.typeFilterSelect, this.agentFilterInput);

    this.listElement = document.createElement('div');
    this.listElement.className = 'log-list';

    this.statsElement = document.createElement('div');
    this.statsElement.className = 'panel-footer';

    this.element.append(headerRow, filterRow, this.listElement, this.statsElement);
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
        const parsed = parseLogEvent(event);
        this.entries.push({
          id: `${state.tickId}-${this.entries.length + 1}`,
          tickId: state.tickId,
          type: parsed.type,
          agentId: parsed.agentId,
          text: parsed.text,
          event,
        });
      }

      if (this.entries.length > this.maxEntries) {
        this.entries.splice(0, this.entries.length - this.maxEntries);
      }

      this.render();
    }

    const filteredEntries = filterLogEntries(this.entries, this.typeFilterSelect.value, this.agentFilterInput.value);
    this.statsElement.textContent = `entries: ${filteredEntries.length}/${this.entries.length} | connected: ${state.connected ? 'yes' : 'no'} | tick: ${state.tickId}`;
  }

  destroy(): void {
    this.element.remove();
  }

  private render(): void {
    this.listElement.innerHTML = '';
    const filteredEntries = filterLogEntries(this.entries, this.typeFilterSelect.value, this.agentFilterInput.value);
    const recent = filteredEntries.slice(Math.max(0, filteredEntries.length - 24));

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
