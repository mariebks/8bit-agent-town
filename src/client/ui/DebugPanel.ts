import { UIPanel, UISimulationState } from './types';

interface DebugOverlayState {
  pathEnabled: boolean;
  perceptionEnabled: boolean;
  updateStride: number;
  pathSampleStep: number;
  perceptionSuppressed: boolean;
}

interface DebugPerfSummary {
  totalAgents: number;
  visibleAgents: number;
  visibleSpeechBubbles: number;
  queuedSpeechMessages: number;
}

interface DebugPanelOptions {
  getSelectedAgentId: () => string | null;
  getOverlayState: () => DebugOverlayState;
  getPerfSummary?: () => DebugPerfSummary;
  onTogglePathOverlay: () => void;
  onTogglePerceptionOverlay: () => void;
}

export class DebugPanel implements UIPanel {
  readonly id = 'debug-panel';
  readonly element: HTMLElement;

  private readonly contentElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;
  private readonly getOverlayState: () => DebugOverlayState;
  private readonly getPerfSummary: (() => DebugPerfSummary) | null;
  private readonly pathToggleButton: HTMLButtonElement;
  private readonly perceptionToggleButton: HTMLButtonElement;

  constructor(options: DebugPanelOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;
    this.getOverlayState = options.getOverlayState;
    this.getPerfSummary = options.getPerfSummary ?? null;

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
    const perfSummary = this.getPerfSummary?.() ?? {
      totalAgents: state.agents.length,
      visibleAgents: state.agents.length,
      visibleSpeechBubbles: 0,
      queuedSpeechMessages: 0,
    };
    this.pathToggleButton.textContent = `Path: ${overlayState.pathEnabled ? 'On' : 'Off'}`;
    this.perceptionToggleButton.textContent = `Perception: ${overlayState.perceptionEnabled ? 'On' : 'Off'}`;

    this.contentElement.textContent = formatDebugPanelLines({
      metrics,
      selectedAgentId,
      selectedAgentLlmOutcome: selectedAgent?.llmTrace?.lastOutcome,
      overlayState,
      perfSummary,
    }).join('\n');
  }

  destroy(): void {
    this.element.remove();
  }
}

interface FormatDebugPanelLinesOptions {
  metrics: UISimulationState['metrics'];
  selectedAgentId: string | null;
  selectedAgentLlmOutcome?: string;
  overlayState: DebugOverlayState;
  perfSummary: DebugPerfSummary;
}

export function formatDebugPanelLines(options: FormatDebugPanelLinesOptions): string[] {
  const { metrics, selectedAgentId, selectedAgentLlmOutcome, overlayState, perfSummary } = options;
  if (!metrics) {
    return [
      'No metrics yet',
      `selected: ${selectedAgentId ?? 'none'}`,
      `agents visible/total: ${perfSummary.visibleAgents}/${perfSummary.totalAgents}`,
      `speech bubbles visible/queued: ${perfSummary.visibleSpeechBubbles}/${perfSummary.queuedSpeechMessages}`,
      `overlay stride/sample: x${overlayState.updateStride} / ${overlayState.pathSampleStep}`,
    ];
  }

  return [
    `tick p50/p95/p99: ${metrics.tickDurationMsP50.toFixed(2)} / ${metrics.tickDurationMsP95.toFixed(2)} / ${metrics.tickDurationMsP99.toFixed(2)} ms`,
    `llm queue depth: ${metrics.queueDepth}`,
    `llm queue max depth: ${metrics.llmQueueMaxDepth ?? 'n/a'}`,
    `llm queue dropped: ${metrics.queueDropped}`,
    `llm queue wait/process avg: ${metrics.llmQueueAvgWaitMs?.toFixed(1) ?? 'n/a'} / ${metrics.llmQueueAvgProcessMs?.toFixed(1) ?? 'n/a'} ms`,
    `llm queue pressure/health: ${metrics.llmQueueBackpressure ?? 'n/a'} / ${(metrics.llmQueueHealthy ?? true) ? 'ok' : 'degraded'}`,
    `llm fallback rate: ${(metrics.llmFallbackRate * 100).toFixed(1)}%`,
    `path cache size/hit rate: ${metrics.pathCacheSize ?? 'n/a'} / ${metrics.pathCacheHitRate !== undefined ? `${(metrics.pathCacheHitRate * 100).toFixed(1)}%` : 'n/a'}`,
    `agents visible/total: ${perfSummary.visibleAgents}/${perfSummary.totalAgents}`,
    `speech bubbles visible/queued: ${perfSummary.visibleSpeechBubbles}/${perfSummary.queuedSpeechMessages}`,
    `overlay stride/sample: x${overlayState.updateStride} / ${overlayState.pathSampleStep}`,
    `overlay perception suppressed: ${overlayState.perceptionSuppressed ? 'yes' : 'no'}`,
    `selected agent: ${selectedAgentId ?? 'none'}`,
    `selected llm outcome: ${selectedAgentLlmOutcome ?? 'n/a'}`,
  ];
}
