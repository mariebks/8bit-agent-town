import { UIPanel, UISimulationState } from './types';
import { buildHighlightsReel, HighlightsEntry } from './HighlightsReel';
import { areHighlightsSnapshotsEqual } from './HighlightsReelViewModel';
import { TimeControlsStatus } from './TimeControlsStatus';
import { extractTimelineEntries } from './TimelineEvents';

const HIGHLIGHT_WINDOW_TICKS = 60;
const HIGHLIGHT_WINDOW_MINUTES = 60;
const MAX_ENTRIES = 180;

interface HighlightsReelPanelOptions {
  onFocusAgent?: (agentId: string) => boolean;
}

export class HighlightsReelPanel implements UIPanel {
  readonly id = 'highlights-reel-panel';
  readonly element: HTMLElement;

  private readonly summaryElement: HTMLElement;
  private readonly spotlightButton: HTMLButtonElement;
  private readonly bulletList: HTMLElement;
  private readonly footerElement: HTMLElement;
  private readonly options: HighlightsReelPanelOptions;
  private readonly status = new TimeControlsStatus();
  private readonly entries: HighlightsEntry[] = [];
  private readonly seenIds = new Set<string>();
  private renderedSnapshot: ReturnType<typeof buildHighlightsReel> | null = null;

  constructor(options: HighlightsReelPanelOptions = {}) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'ui-panel highlights-reel-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Highlights Reel';

    this.summaryElement = document.createElement('p');
    this.summaryElement.className = 'highlights-summary';

    this.spotlightButton = document.createElement('button');
    this.spotlightButton.type = 'button';
    this.spotlightButton.className = 'ui-btn highlights-focus-btn';
    this.spotlightButton.textContent = 'Focus Spotlight';
    this.spotlightButton.disabled = true;
    this.spotlightButton.addEventListener('click', () => {
      const spotlightAgentId = this.renderedSnapshot?.topAgentId ?? null;
      if (!spotlightAgentId || !this.options.onFocusAgent) {
        this.status.setTransient('no spotlight agent');
        return;
      }
      const focused = this.options.onFocusAgent(spotlightAgentId);
      this.status.setTransient(
        focused ? `focused ${this.renderedSnapshot?.topAgentName ?? spotlightAgentId}` : 'spotlight unavailable',
      );
    });

    this.bulletList = document.createElement('ul');
    this.bulletList.className = 'highlights-list';

    this.footerElement = document.createElement('div');
    this.footerElement.className = 'panel-footer';

    this.element.append(header, this.summaryElement, this.spotlightButton, this.bulletList, this.footerElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    if (state.events.length > 0) {
      const incoming = extractTimelineEntries(state.events, {
        tickId: state.tickId,
        agents: state.agents,
      });

      for (const entry of incoming) {
        if (this.seenIds.has(entry.id)) {
          continue;
        }
        this.entries.push({
          ...entry,
          gameMinute: state.gameTime?.totalMinutes,
        });
        this.seenIds.add(entry.id);
      }
    }

    const pruneTickThreshold = state.tickId - HIGHLIGHT_WINDOW_TICKS - 120;
    const pruneMinuteThreshold =
      state.gameTime !== null ? state.gameTime.totalMinutes - (HIGHLIGHT_WINDOW_MINUTES + 120) : null;
    while (
      this.entries.length > 0 &&
      (pruneMinuteThreshold !== null && typeof this.entries[0].gameMinute === 'number'
        ? this.entries[0].gameMinute < pruneMinuteThreshold
        : this.entries[0].tickId < pruneTickThreshold)
    ) {
      const removed = this.entries.shift();
      if (removed) {
        this.seenIds.delete(removed.id);
      }
    }

    if (this.entries.length > MAX_ENTRIES) {
      const removed = this.entries.splice(0, this.entries.length - MAX_ENTRIES);
      for (const entry of removed) {
        this.seenIds.delete(entry.id);
      }
    }

    const reel = buildHighlightsReel(
      this.entries,
      state.agents,
      state.tickId,
      HIGHLIGHT_WINDOW_TICKS,
      state.gameTime?.totalMinutes ?? null,
      HIGHLIGHT_WINDOW_MINUTES,
    );
    if (!areHighlightsSnapshotsEqual(this.renderedSnapshot, reel)) {
      this.summaryElement.textContent = reel.summary;

      this.bulletList.innerHTML = '';
      for (const bullet of reel.bullets) {
        const item = document.createElement('li');
        item.textContent = bullet;
        this.bulletList.append(item);
      }
      this.renderedSnapshot = {
        ...reel,
        bullets: [...reel.bullets],
      };
    }
    this.spotlightButton.disabled = !Boolean(reel.topAgentId && this.options.onFocusAgent);
    this.spotlightButton.textContent = reel.topAgentName ? `Focus ${reel.topAgentName}` : 'Focus Spotlight';
    if (reel.topAgentId) {
      this.spotlightButton.dataset.agentId = reel.topAgentId;
    } else {
      delete this.spotlightButton.dataset.agentId;
    }

    const baseStatus = `window: 1h | events: ${reel.eventCount} | tick ${state.tickId}`;
    this.footerElement.textContent = this.status.resolve(baseStatus);
  }

  destroy(): void {
    this.element.remove();
  }
}
