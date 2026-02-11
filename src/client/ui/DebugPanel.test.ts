import { describe, expect, test } from 'vitest';
import { formatDebugPanelLines } from './DebugPanel';

describe('DebugPanel', () => {
  test('renders live perf summary without server metrics', () => {
    const lines = formatDebugPanelLines({
      metrics: null,
      selectedAgentId: 'agent-1',
      selectedAgentLlmOutcome: undefined,
      overlayState: {
        pathEnabled: true,
        perceptionEnabled: true,
        updateStride: 2,
        pathSampleStep: 3,
        perceptionSuppressed: false,
      },
      perfSummary: {
        totalAgents: 12,
        visibleAgents: 8,
        visibleSpeechBubbles: 3,
        queuedSpeechMessages: 5,
      },
    });
    expect(lines.join('\n')).toContain('No metrics yet');
    expect(lines.join('\n')).toContain('agents visible/total: 8/12');
    expect(lines.join('\n')).toContain('speech bubbles visible/queued: 3/5');
  });

  test('renders perf summary alongside server metrics', () => {
    const lines = formatDebugPanelLines({
      metrics: {
        tickDurationMsP50: 4,
        tickDurationMsP95: 9,
        tickDurationMsP99: 12,
        queueDepth: 1,
        queueDropped: 0,
        llmFallbackRate: 0.2,
      },
      selectedAgentId: null,
      selectedAgentLlmOutcome: undefined,
      overlayState: {
        pathEnabled: false,
        perceptionEnabled: false,
        updateStride: 1,
        pathSampleStep: 1,
        perceptionSuppressed: true,
      },
      perfSummary: {
        totalAgents: 20,
        visibleAgents: 14,
        visibleSpeechBubbles: 4,
        queuedSpeechMessages: 2,
      },
    });
    expect(lines.join('\n')).toContain('agents visible/total: 14/20');
    expect(lines.join('\n')).toContain('speech bubbles visible/queued: 4/2');
  });
});
