import { UIPanel, UISimulationState } from './types';
import { buildAgentIdentityToken } from './AgentIdentity';
import { DigestItem, extractDigestItems, selectDigestHighlights } from './StoryDigest';

const MAX_DIGEST_ITEMS = 3;
const MAX_CACHE_ITEMS = 36;
const DIGEST_STALE_TICKS = 90;

export class StoryDigestPanel implements UIPanel {
  readonly id = 'story-digest-bar';
  readonly element: HTMLElement;

  private readonly listElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly cached = new Map<string, DigestItem>();

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel story-digest-bar';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Now';

    this.listElement = document.createElement('div');
    this.listElement.className = 'digest-list';

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, this.listElement, this.statusElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    if (state.events.length > 0) {
      const incoming = extractDigestItems(state.events, {
        tickId: state.tickId,
        agents: state.agents,
      });
      for (const item of incoming) {
        this.cached.set(item.id, item);
      }
    }

    for (const [id, item] of this.cached.entries()) {
      if (state.tickId - item.tickId > DIGEST_STALE_TICKS) {
        this.cached.delete(id);
      }
    }

    if (this.cached.size > MAX_CACHE_ITEMS) {
      const sorted = [...this.cached.values()].sort((left, right) => right.tickId - left.tickId).slice(0, MAX_CACHE_ITEMS);
      this.cached.clear();
      for (const item of sorted) {
        this.cached.set(item.id, item);
      }
    }

    const top = selectDigestHighlights([...this.cached.values()], MAX_DIGEST_ITEMS);

    this.render(top, state);
    this.statusElement.textContent = top.length > 0 ? `top ${top.length} live moments` : 'watching for moments...';
  }

  destroy(): void {
    this.element.remove();
  }

  private render(items: DigestItem[], state: UISimulationState): void {
    this.listElement.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('article');
      row.className = 'digest-row';

      const agent = item.agentId ? state.agents.find((candidate) => candidate.id === item.agentId) : null;
      const identity = agent ? buildAgentIdentityToken(agent) : null;

      const portrait = document.createElement('div');
      portrait.className = 'digest-portrait';
      portrait.textContent = identity?.initials ?? '•';
      if (identity) {
        portrait.style.background = identity.gradient;
        portrait.style.borderColor = identity.border;
      }

      const copy = document.createElement('div');
      copy.className = 'digest-copy';

      const headline = document.createElement('div');
      headline.className = 'digest-headline';
      headline.textContent = item.headline;

      const meta = document.createElement('div');
      meta.className = 'digest-meta';
      meta.textContent = identity ? `${identity.roleBadge} | t${item.tickId}` : `t${item.tickId}`;

      copy.append(headline, meta);
      row.append(portrait, copy);
      this.listElement.append(row);
    }
  }
}
