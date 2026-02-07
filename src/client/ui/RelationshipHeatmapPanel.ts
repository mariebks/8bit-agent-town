import { UIPanel, UISimulationState } from './types';
import { buildRelationshipHeatRows } from './RelationshipHeatmap';

interface RelationshipHeatmapPanelOptions {
  getSelectedAgentId: () => string | null;
}

export class RelationshipHeatmapPanel implements UIPanel {
  readonly id = 'relationship-heatmap-panel';
  readonly element: HTMLElement;

  private readonly rowsElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;

  constructor(options: RelationshipHeatmapPanelOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel relationship-heatmap-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Relationship Heatmap';

    this.rowsElement = document.createElement('div');
    this.rowsElement.className = 'heatmap-rows';

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, this.rowsElement, this.statusElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    const selectedAgentId = this.getSelectedAgentId();
    if (!selectedAgentId) {
      this.rowsElement.innerHTML = '<div class="heatmap-empty">Select an agent to view social map.</div>';
      this.statusElement.textContent = 'no selection';
      return;
    }

    const selected = state.agents.find((agent) => agent.id === selectedAgentId);
    if (!selected) {
      this.rowsElement.innerHTML = '<div class="heatmap-empty">Agent not found in latest snapshot.</div>';
      this.statusElement.textContent = 'stale selection';
      return;
    }

    const rows = buildRelationshipHeatRows(selected, state.agents).slice(0, 8);
    this.rowsElement.innerHTML = '';

    if (rows.length === 0) {
      this.rowsElement.innerHTML = '<div class="heatmap-empty">No relationship edges yet.</div>';
      this.statusElement.textContent = `${selected.name}: warming up`;
      return;
    }

    for (const row of rows) {
      const item = document.createElement('div');
      item.className = `heatmap-row heatmap-${row.stance}`;

      const label = document.createElement('div');
      label.className = 'heatmap-label';
      label.textContent = `${row.targetName} (${row.weight >= 0 ? '+' : ''}${row.weight})`;

      const bar = document.createElement('div');
      bar.className = 'heatmap-bar';
      const fill = document.createElement('div');
      fill.className = 'heatmap-fill';
      fill.style.width = `${Math.max(8, Math.round(row.intensity * 100))}%`;
      bar.append(fill);

      item.append(label, bar);
      this.rowsElement.append(item);
    }

    this.statusElement.textContent = `${selected.name}: ${rows.length} strongest ties`;
  }

  destroy(): void {
    this.element.remove();
  }
}
