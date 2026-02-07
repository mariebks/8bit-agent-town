import { UIPanel, UISimulationState } from './types';
import { searchAgents } from './AgentFinder';

interface AgentFinderPanelOptions {
  onFocusAgent: (agentId: string) => boolean;
}

export class AgentFinderPanel implements UIPanel {
  readonly id = 'agent-finder-panel';
  readonly element: HTMLElement;

  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly status: HTMLElement;
  private readonly options: AgentFinderPanelOptions;
  private query = '';

  constructor(options: AgentFinderPanelOptions) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'ui-panel agent-finder-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Agent Finder';

    this.input = document.createElement('input');
    this.input.className = 'ui-input';
    this.input.type = 'text';
    this.input.placeholder = 'Find agent or role...';
    this.input.addEventListener('input', () => {
      this.query = this.input.value;
    });

    this.list = document.createElement('div');
    this.list.className = 'agent-finder-list';

    this.status = document.createElement('div');
    this.status.className = 'panel-footer';

    this.element.append(header, this.input, this.list, this.status);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    const hits = searchAgents(this.query, state.agents, 6);
    this.renderHits(hits);
    this.status.textContent = hits.length > 0 ? `${hits.length} match${hits.length === 1 ? '' : 'es'}` : 'type to search';
  }

  destroy(): void {
    this.element.remove();
  }

  focusQueryInput(): void {
    this.input.focus();
    this.input.select();
  }

  private renderHits(hits: Array<{ id: string; name: string; occupation: string | null }>): void {
    this.list.innerHTML = '';
    for (const hit of hits) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ui-btn agent-finder-row';
      row.textContent = hit.occupation ? `${hit.name} · ${hit.occupation}` : hit.name;
      row.title = `Jump to ${hit.name}`;
      row.addEventListener('click', () => {
        const focused = this.options.onFocusAgent(hit.id);
        if (!focused) {
          this.status.textContent = `could not focus ${hit.name}`;
          return;
        }
        this.status.textContent = `focused ${hit.name}`;
      });
      this.list.append(row);
    }
  }
}
