import { describe, expect, test } from 'vitest';
import { buildStressSummaryReport } from './StressReport';
import { StressTestResults } from './StressTest';

function makeResult(overrides: Partial<StressTestResults>): StressTestResults {
  return {
    profileName: 'baseline-no-llm',
    durationDaysRequested: 1,
    totalTicks: 1440,
    totalGameDays: 1,
    tickTiming: {
      minMs: 0.1,
      maxMs: 2,
      avgMs: 0.5,
      p50Ms: 0.4,
      p95Ms: 1.2,
      p99Ms: 1.8,
    },
    memoryStats: {
      peakHeapUsed: 10 * 1024 * 1024,
      averageHeapUsed: 8 * 1024 * 1024,
    },
    queueSummary: {
      maxDepthObserved: 0,
      maxDroppedObserved: 0,
      unhealthyCheckpointCount: 0,
      elevatedBackpressureCheckpointCount: 0,
      criticalBackpressureCheckpointCount: 0,
    },
    finalMetrics: {
      tickDurationMsP50: 0.4,
      tickDurationMsP95: 1.2,
      tickDurationMsP99: 1.8,
      queueDepth: 0,
      queueDropped: 0,
      llmFallbackRate: 0,
    },
    checkpoints: [],
    issues: [],
    ...overrides,
  };
}

describe('StressReport', () => {
  test('renders markdown summary for multiple profiles', () => {
    const report = buildStressSummaryReport([
      makeResult({ profileName: 'baseline-no-llm' }),
      makeResult({
        profileName: 'llm-on',
        finalMetrics: {
          tickDurationMsP50: 0.6,
          tickDurationMsP95: 1.4,
          tickDurationMsP99: 2.2,
          queueDepth: 1,
          queueDropped: 0,
          llmFallbackRate: 0.25,
        },
      }),
    ]);

    expect(report).toContain('# Stress Test Summary');
    expect(report).toContain('| baseline-no-llm |');
    expect(report).toContain('| llm-on |');
    expect(report).toContain('25.0%');
    expect(report).toContain('Peak Heap');
  });

  test('handles empty input gracefully', () => {
    const report = buildStressSummaryReport([]);
    expect(report).toContain('No profiles were executed');
  });
});
