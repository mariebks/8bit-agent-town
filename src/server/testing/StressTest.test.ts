import { describe, expect, test } from 'vitest';
import { StressTestRunner, buildDefaultStressProfiles } from './StressTest';

describe('StressTestRunner', () => {
  test('runs a short baseline profile and returns metrics', async () => {
    const runner = new StressTestRunner({
      profileName: 'test-baseline',
      durationDays: 0.02,
      agentCount: 8,
      seed: 7,
      llmEnabled: false,
      checkpointIntervalMinutes: 10,
      overrunBudgetMs: 220,
    });

    const result = await runner.run();

    expect(result.profileName).toBe('test-baseline');
    expect(result.totalTicks).toBeGreaterThan(0);
    expect(result.tickTiming.p95Ms).toBeGreaterThanOrEqual(0);
    expect(result.memoryStats.peakHeapUsed).toBeGreaterThan(0);
    expect(result.checkpoints.length).toBeGreaterThan(0);
    expect(result.queueSummary.maxDepthObserved).toBeGreaterThanOrEqual(0);
    expect(result.finalMetrics.queueDepth).toBeGreaterThanOrEqual(0);
  });

  test('builds baseline and llm default stress profiles', () => {
    const profiles = buildDefaultStressProfiles({ durationDays: 1, agentCount: 20, seed: 99 });
    expect(profiles).toHaveLength(2);
    expect(profiles[0].profileName).toBe('baseline-no-llm');
    expect(profiles[0].llmEnabled).toBe(false);
    expect(profiles[1].profileName).toBe('llm-on');
    expect(profiles[1].llmEnabled).toBe(true);
  });
});
