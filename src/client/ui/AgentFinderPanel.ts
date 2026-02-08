import { UIPanel, UISimulationState } from './types';
import { searchAgents } from './AgentFinder';
import { nextHighlightedIndex, normalizeHighlightedIndex } from './AgentFinderNavigation';

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
  private lastHits: Array<{ id: string; name: string; occupation: string | null }> = [];
  private highlightedIndex = -1;
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
      this.highlightedIndex = -1;
    });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.highlightedIndex = nextHighlightedIndex(this.highlightedIndex, this.lastHits.length, 'down');
        this.renderHits(this.lastHits);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.highlightedIndex = nextHighlightedIndex(this.highlightedIndex, this.lastHits.length, 'up');
        this.renderHits(this.lastHits);
        return;
      }
      if (event.key === 'Enter') {
        const index = this.highlightedIndex < 0 ? 0 : normalizeHighlightedIndex(this.highlightedIndex, this.lastHits.length);
        const hit = this.lastHits[index];
        if (hit) {
          event.preventDefault();
          this.tryFocus(hit.id, hit.name);
        }
      }
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
    this.lastHits = hits;
    this.highlightedIndex = normalizeHighlightedIndex(this.highlightedIndex, hits.length);
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
    for (let index = 0; index < hits.length; index += 1) {
      const hit = hits[index];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ui-btn agent-finder-row';
      row.classList.toggle('active', index === this.highlightedIndex);
      row.textContent = hit.occupation ? `${hit.name} · ${hit.occupation}` : hit.name;
      row.title = `Jump to ${hit.name}`;
      row.addEventListener('click', () => {
        this.tryFocus(hit.id, hit.name);
      });
      this.list.append(row);
    }
  }

  private tryFocus(agentId: string, agentName: string): void {
    const focused = this.options.onFocusAgent(agentId);
    if (!focused) {
      this.status.textContent = `could not focus ${agentName}`;
      return;
    }
    this.status.textContent = `focused ${agentName}`;
  }
}
