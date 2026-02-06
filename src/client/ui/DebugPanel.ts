import { UIPanel, UISimulationState } from './types';

interface DebugPanelOptions {
  getSelectedAgentId: () => string | null;
}

export class DebugPanel implements UIPanel {
  readonly id = 'debug-panel';
  readonly element: HTMLElement;

  private readonly contentElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;

  constructor(options: DebugPanelOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel debug-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Debug Metrics';

    this.contentElement = document.createElement('pre');
    this.contentElement.className = 'inspector-content';

    this.element.append(header, this.contentElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    const metrics = state.metrics;
    const selectedAgentId = this.getSelectedAgentId();
    const selectedAgent = selectedAgentId ? state.agents.find((agent) => agent.id === selectedAgentId) : null;

    if (!metrics) {
      this.contentElement.textContent = `No metrics yet\nselected: ${selectedAgentId ?? 'none'}`;
      return;
    }

    this.contentElement.textContent = [
      `tick p50/p95/p99: ${metrics.tickDurationMsP50.toFixed(2)} / ${metrics.tickDurationMsP95.toFixed(2)} / ${metrics.tickDurationMsP99.toFixed(2)} ms`,
      `llm queue depth: ${metrics.queueDepth}`,
      `llm queue max depth: ${metrics.llmQueueMaxDepth ?? 'n/a'}`,
      `llm queue dropped: ${metrics.queueDropped}`,
      `llm queue wait/process avg: ${metrics.llmQueueAvgWaitMs?.toFixed(1) ?? 'n/a'} / ${metrics.llmQueueAvgProcessMs?.toFixed(1) ?? 'n/a'} ms`,
      `llm queue pressure/health: ${metrics.llmQueueBackpressure ?? 'n/a'} / ${(metrics.llmQueueHealthy ?? true) ? 'ok' : 'degraded'}`,
      `llm fallback rate: ${(metrics.llmFallbackRate * 100).toFixed(1)}%`,
      `path cache size/hit rate: ${metrics.pathCacheSize ?? 'n/a'} / ${metrics.pathCacheHitRate !== undefined ? `${(metrics.pathCacheHitRate * 100).toFixed(1)}%` : 'n/a'}`,
      `selected agent: ${selectedAgentId ?? 'none'}`,
      `selected llm outcome: ${selectedAgent?.llmTrace?.lastOutcome ?? 'n/a'}`,
    ].join('\n');
  }

  destroy(): void {
    this.element.remove();
  }
}
