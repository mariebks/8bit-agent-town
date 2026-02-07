import { UIPanel, UISimulationState } from './types';
import { buildAgentIdentityToken } from './AgentIdentity';
import { TimelineEntry, extractTimelineEntries } from './TimelineEvents';

const MAX_TIMELINE_ENTRIES = 120;

export class TimelinePanel implements UIPanel {
  readonly id = 'timeline-panel';
  readonly element: HTMLElement;

  private readonly headerElement: HTMLElement;
  private readonly listElement: HTMLElement;
  private readonly footerElement: HTMLElement;
  private readonly entries: TimelineEntry[] = [];
  private readonly seenIds = new Set<string>();
  private readonly interestingAgentQueue: string[] = [];
  private nextInterestingIndex = 0;
  private lastRenderedMode: UISimulationState['uiMode'] | null = null;

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel timeline-panel';

    this.headerElement = document.createElement('header');
    this.headerElement.className = 'panel-header';
    this.headerElement.textContent = 'Timeline';

    this.listElement = document.createElement('div');
    this.listElement.className = 'timeline-list';

    this.footerElement = document.createElement('div');
    this.footerElement.className = 'panel-footer';

    this.element.append(this.headerElement, this.listElement, this.footerElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    if (state.events.length > 0) {
      const timelineEntries = extractTimelineEntries(state.events, {
        tickId: state.tickId,
        agents: state.agents,
      });

      for (const entry of timelineEntries) {
        if (this.seenIds.has(entry.id)) {
          continue;
        }
        this.entries.push(entry);
        this.seenIds.add(entry.id);
        this.enqueueInterestingAgent(entry.agentId);
      }

      if (this.entries.length > MAX_TIMELINE_ENTRIES) {
        const removed = this.entries.splice(0, this.entries.length - MAX_TIMELINE_ENTRIES);
        for (const entry of removed) {
          this.seenIds.delete(entry.id);
        }
      }
    }

    this.headerElement.textContent = state.uiMode === 'spectator' ? 'Story Stream' : 'Timeline';
    if (state.events.length > 0 || this.lastRenderedMode !== state.uiMode) {
      this.render(state.uiMode, state);
      this.lastRenderedMode = state.uiMode;
    }
    this.footerElement.textContent = `events: ${this.entries.length} | tick: ${state.tickId} | mode: ${state.uiMode}`;
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

  private render(mode: UISimulationState['uiMode'], state: UISimulationState): void {
    this.listElement.innerHTML = '';
    const sourceEntries = mode === 'spectator' ? this.entries.filter((entry) => entry.kind !== 'system') : this.entries;
    const limit = mode === 'spectator' ? 10 : mode === 'story' ? 14 : 18;
    const recent = sourceEntries.slice(Math.max(0, sourceEntries.length - limit));

    for (const entry of recent) {
      const item = document.createElement('article');
      item.className = `timeline-card timeline-${entry.kind}`;
      item.dataset.kind = entry.kind;

      const frame = document.createElement('div');
      frame.className = 'timeline-frame';

      const portrait = document.createElement('div');
      portrait.className = 'timeline-portrait';
      const agent = entry.agentId ? state.agents.find((candidate) => candidate.id === entry.agentId) : null;
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
      this.listElement.append(item);
    }

    this.listElement.scrollTop = this.listElement.scrollHeight;
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
