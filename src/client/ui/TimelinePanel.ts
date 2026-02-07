import { UIPanel, UISimulationState } from './types';
import { TimelineEntry, extractTimelineEntries } from './TimelineEvents';

const MAX_TIMELINE_ENTRIES = 120;

export class TimelinePanel implements UIPanel {
  readonly id = 'timeline-panel';
  readonly element: HTMLElement;

  private readonly listElement: HTMLElement;
  private readonly footerElement: HTMLElement;
  private readonly entries: TimelineEntry[] = [];
  private readonly seenIds = new Set<string>();
  private readonly interestingAgentQueue: string[] = [];
  private nextInterestingIndex = 0;

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel timeline-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Timeline';

    this.listElement = document.createElement('div');
    this.listElement.className = 'timeline-list';

    this.footerElement = document.createElement('div');
    this.footerElement.className = 'panel-footer';

    this.element.append(header, this.listElement, this.footerElement);
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

      this.render();
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

  private render(): void {
    this.listElement.innerHTML = '';
    const recent = this.entries.slice(Math.max(0, this.entries.length - 18));

    for (const entry of recent) {
      const item = document.createElement('article');
      item.className = `timeline-card timeline-${entry.kind}`;
      item.dataset.kind = entry.kind;

      const title = document.createElement('div');
      title.className = 'timeline-headline';
      title.textContent = entry.headline;

      const detail = document.createElement('div');
      detail.className = 'timeline-detail';
      detail.textContent = entry.detail ? `${entry.detail} | tick ${entry.tickId}` : `tick ${entry.tickId}`;

      item.append(title, detail);
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
