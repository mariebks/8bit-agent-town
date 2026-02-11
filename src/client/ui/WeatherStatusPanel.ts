import { UIPanel, UISimulationState } from './types';
import { buildWeatherStatus } from './WeatherStatus';

const MAX_RECENT_TOPICS = 12;

export class WeatherStatusPanel implements UIPanel {
  readonly id = 'weather-status-panel';
  readonly element: HTMLElement;

  private readonly labelElement: HTMLElement;
  private readonly detailElement: HTMLElement;
  private readonly footerElement: HTMLElement;
  private readonly recentTopics: string[] = [];

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel weather-status-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Town Atmosphere';

    this.labelElement = document.createElement('div');
    this.labelElement.className = 'weather-status-label';

    this.detailElement = document.createElement('div');
    this.detailElement.className = 'panel-subheader';

    this.footerElement = document.createElement('div');
    this.footerElement.className = 'panel-footer';

    this.element.append(header, this.labelElement, this.detailElement, this.footerElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    for (const event of state.events) {
      if (!event || typeof event !== 'object') {
        continue;
      }
      const typed = event as Record<string, unknown>;
      if (typed.type === 'topicSpread' && typeof typed.topic === 'string') {
        this.recentTopics.push(typed.topic);
      }
    }

    if (this.recentTopics.length > MAX_RECENT_TOPICS) {
      this.recentTopics.splice(0, this.recentTopics.length - MAX_RECENT_TOPICS);
    }

    const snapshot = buildWeatherStatus(state.agents, this.recentTopics);
    this.labelElement.textContent = snapshot.label;
    this.detailElement.textContent = snapshot.themeTopic ? `theme: ${snapshot.themeTopic}` : 'theme: calm';
    this.footerElement.textContent = `rain ${Math.round(snapshot.rainIntensity * 100)}% | topic samples ${this.recentTopics.length}`;
  }

  destroy(): void {
    this.element.remove();
  }
}
