import { UIPanel, UISimulationState } from './types';
import { buildAgentIdentityToken } from './AgentIdentity';
import { TimeControlsStatus } from './TimeControlsStatus';
import { TimelineEntry, extractTimelineEntries } from './TimelineEvents';
import { loadTimelineFilter, storeTimelineFilter, TimelineFilter } from './TimelineFilterPreference';

const MAX_TIMELINE_ENTRIES = 120;
const TIMELINE_DUPLICATE_WINDOW_TICKS = 6;

interface TimelinePanelOptions {
  onFocusAgent?: (agentId: string) => boolean;
}

export function matchesTimelineFilter(entry: TimelineEntry, filter: TimelineFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'social') {
    return entry.kind === 'conversation' || entry.kind === 'relationship' || entry.kind === 'topic';
  }
  if (filter === 'planning') {
    return entry.kind === 'plan' || entry.kind === 'reflection' || entry.kind === 'arrival';
  }
  if (filter === 'system') {
    return entry.kind === 'system';
  }
  const normalizedHeadline = entry.headline.toLowerCase();
  const normalizedDetail = (entry.detail ?? '').toLowerCase();
  return (
    (entry.kind === 'relationship' && normalizedHeadline.includes('rival')) ||
    normalizedHeadline.includes('conflict') ||
    normalizedHeadline.includes('argu') ||
    normalizedDetail.includes('social discomfort') ||
    normalizedDetail.includes('interrupted')
  );
}

export function shouldAppendTimelineEntry(previous: TimelineEntry | null, next: TimelineEntry): boolean {
  if (!previous) {
    return true;
  }

  if (
    previous.kind !== next.kind ||
    previous.agentId !== next.agentId ||
    previous.headline !== next.headline ||
    !haveSameActors(previous.actorIds, next.actorIds)
  ) {
    return true;
  }

  return next.tickId - previous.tickId > TIMELINE_DUPLICATE_WINDOW_TICKS;
}

function haveSameActors(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    if (normalizedLeft[index] !== normalizedRight[index]) {
      return false;
    }
  }
  return true;
}

export class TimelinePanel implements UIPanel {
  readonly id = 'timeline-panel';
  readonly element: HTMLElement;

  private readonly headerElement: HTMLElement;
  private readonly filterRowElement: HTMLElement;
  private readonly listElement: HTMLElement;
  private readonly footerElement: HTMLElement;
  private readonly options: TimelinePanelOptions;
  private readonly status = new TimeControlsStatus();
  private readonly entries: TimelineEntry[] = [];
  private readonly seenIds = new Set<string>();
  private readonly interestingAgentQueue: string[] = [];
  private nextInterestingIndex = 0;
  private lastRenderedMode: UISimulationState['uiMode'] | null = null;
  private lastState: UISimulationState | null = null;
  private activeFilter: TimelineFilter;

  constructor(options: TimelinePanelOptions = {}) {
    this.options = options;
    this.activeFilter = loadTimelineFilter(typeof window !== 'undefined' ? window.localStorage : null);
    this.element = document.createElement('section');
    this.element.className = 'ui-panel timeline-panel';

    this.headerElement = document.createElement('header');
    this.headerElement.className = 'panel-header';
    this.headerElement.textContent = 'Timeline';

    this.filterRowElement = document.createElement('div');
    this.filterRowElement.className = 'timeline-filter-row';
    this.renderFilterButtons();

    this.listElement = document.createElement('div');
    this.listElement.className = 'timeline-list';

    this.footerElement = document.createElement('div');
    this.footerElement.className = 'panel-footer';

    this.element.append(this.headerElement, this.filterRowElement, this.listElement, this.footerElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    this.lastState = state;
    let entriesChanged = false;
    if (state.events.length > 0) {
      const timelineEntries = extractTimelineEntries(state.events, {
        tickId: state.tickId,
        agents: state.agents,
      });

      for (const entry of timelineEntries) {
        if (this.seenIds.has(entry.id)) {
          continue;
        }
        const previous = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
        if (!shouldAppendTimelineEntry(previous, entry)) {
          continue;
        }
        this.entries.push(entry);
        this.seenIds.add(entry.id);
        this.enqueueInterestingAgent(entry.agentId);
        entriesChanged = true;
      }

      if (this.entries.length > MAX_TIMELINE_ENTRIES) {
        const removed = this.entries.splice(0, this.entries.length - MAX_TIMELINE_ENTRIES);
        for (const entry of removed) {
          this.seenIds.delete(entry.id);
        }
        entriesChanged = entriesChanged || removed.length > 0;
      }
    }

    this.headerElement.textContent = state.uiMode === 'spectator' ? 'Story Stream' : 'Timeline';
    if (entriesChanged || this.lastRenderedMode !== state.uiMode) {
      this.render(state.uiMode, state);
      this.lastRenderedMode = state.uiMode;
    }
    const baseFooter = `events: ${this.entries.length} | filter: ${this.activeFilter} | tick: ${state.tickId} | mode: ${state.uiMode}`;
    this.footerElement.textContent = this.status.resolve(baseFooter);
  }

  destroy(): void {
    this.element.remove();
  }

  nextInterestingAgentId(): string | null {
    if (this.interestingAgentQueue.length === 0) {
      return null;
    }

    const resolved = this.interestingAgentQueue[this.nextInterestingIndex % this.interestingAgentQueue.length];
    this.nextInterestingIndex = (this.nextInterestingIndex + 1) % this.interestingAgentQueue.length;
    return resolved;
  }

  interestingAgentCount(): number {
    return this.interestingAgentQueue.length;
  }

  private render(mode: UISimulationState['uiMode'], state: UISimulationState): void {
    this.listElement.innerHTML = '';
    const modeEntries = mode === 'spectator' ? this.entries.filter((entry) => entry.kind !== 'system') : this.entries;
    const sourceEntries = modeEntries.filter((entry) => matchesTimelineFilter(entry, this.activeFilter));
    const limit = mode === 'spectator' ? 10 : mode === 'story' ? 14 : 18;
    const recent = sourceEntries.slice(Math.max(0, sourceEntries.length - limit));
    const agentsById = new Map(state.agents.map((agent) => [agent.id, agent] as const));

    for (const entry of recent) {
      const item = document.createElement('article');
      item.className = `timeline-card timeline-${entry.kind}`;
      item.dataset.kind = entry.kind;
      if (entry.agentId) {
        item.dataset.agentId = entry.agentId;
      }

      const frame = document.createElement('div');
      frame.className = 'timeline-frame';

      const portrait = document.createElement('div');
      portrait.className = 'timeline-portrait';
      const agent = entry.agentId ? (agentsById.get(entry.agentId) ?? null) : null;
      if (agent) {
        const identity = buildAgentIdentityToken(agent);
        portrait.textContent = identity.initials;
        portrait.style.background = identity.gradient;
        portrait.style.borderColor = identity.border;
      } else {
        portrait.textContent = '•';
      }

      const copy = document.createElement('div');
      copy.className = 'timeline-copy';

      const title = document.createElement('div');
      title.className = 'timeline-headline';
      title.textContent = entry.headline;

      const detail = document.createElement('div');
      detail.className = 'timeline-detail';
      const roleBadge = agent?.occupation ? agent.occupation : null;
      const detailBody = entry.detail ?? 'event';
      detail.textContent = roleBadge ? `${detailBody} | ${roleBadge} | tick ${entry.tickId}` : `${detailBody} | tick ${entry.tickId}`;

      copy.append(title, detail);
      frame.append(portrait, copy);
      item.append(frame);
      if (entry.agentId && this.options.onFocusAgent) {
        item.classList.add('timeline-focusable');
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        const focusLabel = agent?.name?.trim() || entry.agentId;
        const focusAgent = () => {
          const focused = this.options.onFocusAgent?.(entry.agentId ?? '');
          this.status.setTransient(focused ? `focused ${focusLabel}` : 'agent unavailable');
        };
        item.addEventListener('click', focusAgent);
        item.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          focusAgent();
        });
      }
      this.listElement.append(item);
    }

    this.listElement.scrollTop = this.listElement.scrollHeight;
  }

  private renderFilterButtons(): void {
    this.filterRowElement.innerHTML = '';
    const filters: Array<{ id: TimelineFilter; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'social', label: 'Social' },
      { id: 'conflict', label: 'Conflict' },
      { id: 'planning', label: 'Planning' },
      { id: 'system', label: 'System' },
    ];

    for (const filter of filters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-btn ui-btn-ghost timeline-filter-btn';
      button.dataset.filter = filter.id;
      button.textContent = filter.label;
      button.classList.toggle('active', this.activeFilter === filter.id);
      button.addEventListener('click', () => {
        this.activeFilter = filter.id;
        storeTimelineFilter(this.activeFilter, typeof window !== 'undefined' ? window.localStorage : null);
        this.status.setTransient(`timeline filter: ${filter.label.toLowerCase()}`);
        this.renderFilterButtons();
        if (this.lastState) {
          this.render(this.lastState.uiMode, this.lastState);
        }
      });
      this.filterRowElement.append(button);
    }
  }

  private enqueueInterestingAgent(agentId: string | undefined): void {
    if (!agentId) {
      return;
    }

    if (!this.interestingAgentQueue.includes(agentId)) {
      this.interestingAgentQueue.push(agentId);
      return;
    }

    const currentIndex = this.interestingAgentQueue.indexOf(agentId);
    if (currentIndex < 0) {
      return;
    }
    this.interestingAgentQueue.splice(currentIndex, 1);
    this.interestingAgentQueue.push(agentId);
  }
}
