import { UIPanel, UISimulationState } from './types';

interface DebugOverlayState {
  pathEnabled: boolean;
  perceptionEnabled: boolean;
  updateStride: number;
  pathSampleStep: number;
  perceptionSuppressed: boolean;
}

interface DebugPanelOptions {
  getSelectedAgentId: () => string | null;
  getOverlayState: () => DebugOverlayState;
  onTogglePathOverlay: () => void;
  onTogglePerceptionOverlay: () => void;
}

export class DebugPanel implements UIPanel {
  readonly id = 'debug-panel';
  readonly element: HTMLElement;

  private readonly contentElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;
  private readonly getOverlayState: () => DebugOverlayState;
  private readonly pathToggleButton: HTMLButtonElement;
  private readonly perceptionToggleButton: HTMLButtonElement;

  constructor(options: DebugPanelOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;
    this.getOverlayState = options.getOverlayState;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel debug-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Debug Metrics';

    const controls = document.createElement('div');
    controls.className = 'time-controls-row';

    this.pathToggleButton = document.createElement('button');
    this.pathToggleButton.type = 'button';
    this.pathToggleButton.className = 'ui-btn';
    this.pathToggleButton.addEventListener('click', () => options.onTogglePathOverlay());

    this.perceptionToggleButton = document.createElement('button');
    this.perceptionToggleButton.type = 'button';
    this.perceptionToggleButton.className = 'ui-btn';
    this.perceptionToggleButton.addEventListener('click', () => options.onTogglePerceptionOverlay());

    controls.append(this.pathToggleButton, this.perceptionToggleButton);

    this.contentElement = document.createElement('pre');
    this.contentElement.className = 'inspector-content';

    this.element.append(header, controls, this.contentElement);
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
    const overlayState = this.getOverlayState();
    this.pathToggleButton.textContent = `Path: ${overlayState.pathEnabled ? 'On' : 'Off'}`;
    this.perceptionToggleButton.textContent = `Perception: ${overlayState.perceptionEnabled ? 'On' : 'Off'}`;

    if (!metrics) {
      this.contentElement.textContent = [
        'No metrics yet',
        `selected: ${selectedAgentId ?? 'none'}`,
        `overlay stride/sample: x${overlayState.updateStride} / ${overlayState.pathSampleStep}`,
      ].join('\n');
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
      `overlay stride/sample: x${overlayState.updateStride} / ${overlayState.pathSampleStep}`,
      `overlay perception suppressed: ${overlayState.perceptionSuppressed ? 'yes' : 'no'}`,
      `selected agent: ${selectedAgentId ?? 'none'}`,
      `selected llm outcome: ${selectedAgent?.llmTrace?.lastOutcome ?? 'n/a'}`,
    ].join('\n');
  }

  destroy(): void {
    this.element.remove();
  }
}
