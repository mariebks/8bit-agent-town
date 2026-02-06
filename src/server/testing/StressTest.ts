import { GAME_MINUTES_PER_TICK } from '@shared/Constants';
import { SimulationMetrics } from '@shared/Types';
import { Simulation } from '../simulation/Simulation';
import { loadTownMap } from '../world/MapLoader';

const MINUTES_PER_DAY = 24 * 60;

const DEFAULT_CHECKPOINT_INTERVAL_MINUTES = 120;
const DEFAULT_OVERRUN_BUDGET_MS = 220;
const DEFAULT_MAX_RECORDED_ISSUES = 50;

export interface StressTestConfig {
  profileName?: string;
  durationDays: number;
  agentCount: number;
  seed: number;
  llmEnabled: boolean;
  checkpointIntervalMinutes?: number;
  overrunBudgetMs?: number;
  mapPath?: string;
  maxRecordedIssues?: number;
}

export interface StressTestIssue {
  tickId: number;
  type: 'tickOverrun' | 'queueUnhealthy';
  severity: 'warn' | 'error';
  message: string;
}

export interface TickTimingStats {
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface StressCheckpoint {
  tickId: number;
  gameDay: number;
  queueDepth: number;
  queueDropped: number;
  llmFallbackRate: number;
  llmQueueBackpressure: 'normal' | 'elevated' | 'critical';
  llmQueueHealthy: boolean;
  pathCacheHitRate: number;
}

export interface StressQueueSummary {
  maxDepthObserved: number;
  maxDroppedObserved: number;
  unhealthyCheckpointCount: number;
  elevatedBackpressureCheckpointCount: number;
  criticalBackpressureCheckpointCount: number;
}

export interface StressTestResults {
  profileName: string;
  durationDaysRequested: number;
  totalTicks: number;
  totalGameDays: number;
  tickTiming: TickTimingStats;
  memoryStats: {
    peakHeapUsed: number;
    averageHeapUsed: number;
  };
  queueSummary: StressQueueSummary;
  finalMetrics: SimulationMetrics;
  checkpoints: StressCheckpoint[];
  issues: StressTestIssue[];
}

interface ResolvedStressConfig extends Required<Omit<StressTestConfig, 'profileName'>> {
  profileName: string;
}

export interface StressProfileOptions {
  durationDays?: number;
  agentCount?: number;
  seed?: number;
  checkpointIntervalMinutes?: number;
  overrunBudgetMs?: number;
  mapPath?: string;
}

export function buildDefaultStressProfiles(options: StressProfileOptions = {}): StressTestConfig[] {
  const base = {
    durationDays: options.durationDays ?? 10,
    agentCount: options.agentCount ?? 20,
    seed: options.seed ?? 42,
    checkpointIntervalMinutes: options.checkpointIntervalMinutes ?? DEFAULT_CHECKPOINT_INTERVAL_MINUTES,
    overrunBudgetMs: options.overrunBudgetMs ?? DEFAULT_OVERRUN_BUDGET_MS,
    mapPath: options.mapPath,
  };

  return [
    {
      profileName: 'baseline-no-llm',
      ...base,
      llmEnabled: false,
    },
    {
      profileName: 'llm-on',
      ...base,
      llmEnabled: true,
    },
  ];
}

export class StressTestRunner {
  private readonly config: ResolvedStressConfig;

  constructor(config: StressTestConfig) {
    this.config = {
      profileName: config.profileName ?? (config.llmEnabled ? 'llm-on' : 'baseline-no-llm'),
      durationDays: config.durationDays,
      agentCount: config.agentCount,
      seed: config.seed,
      llmEnabled: config.llmEnabled,
      checkpointIntervalMinutes: config.checkpointIntervalMinutes ?? DEFAULT_CHECKPOINT_INTERVAL_MINUTES,
      overrunBudgetMs: config.overrunBudgetMs ?? DEFAULT_OVERRUN_BUDGET_MS,
      mapPath: config.mapPath ?? '',
      maxRecordedIssues: config.maxRecordedIssues ?? DEFAULT_MAX_RECORDED_ISSUES,
    };
  }

  async run(): Promise<StressTestResults> {
    this.validateConfig();

    const totalTicks = Math.max(1, Math.floor((this.config.durationDays * MINUTES_PER_DAY) / GAME_MINUTES_PER_TICK));
    const checkpointEveryTicks = Math.max(1, Math.floor(this.config.checkpointIntervalMinutes / GAME_MINUTES_PER_TICK));
    const mapData = loadTownMap(this.config.mapPath || undefined);
    const simulation = new Simulation(mapData, {
      seed: this.config.seed,
      agentCount: this.config.agentCount,
      llmEnabled: this.config.llmEnabled,
    });

    const tickDurations: number[] = [];
    const heapSamples: number[] = [];
    const checkpoints: StressCheckpoint[] = [];
    const issues: StressTestIssue[] = [];

    let maxDepthObserved = 0;
    let maxDroppedObserved = 0;
    let unhealthyCheckpointCount = 0;
    let elevatedBackpressureCheckpointCount = 0;
    let criticalBackpressureCheckpointCount = 0;

    for (let tickId = 1; tickId <= totalTicks; tickId += 1) {
      const startedAt = performance.now();
      simulation.tick(tickId);
      const tickDurationMs = Math.max(0, performance.now() - startedAt);
      tickDurations.push(tickDurationMs);
      heapSamples.push(process.memoryUsage().heapUsed);

      if (tickDurationMs > this.config.overrunBudgetMs) {
        this.recordIssue(issues, {
          tickId,
          type: 'tickOverrun',
          severity: tickDurationMs > this.config.overrunBudgetMs * 1.5 ? 'error' : 'warn',
          message: `Tick ${tickId} exceeded budget (${tickDurationMs.toFixed(2)}ms > ${this.config.overrunBudgetMs}ms)`,
        });
      }

      if (tickId % checkpointEveryTicks !== 0 && tickId !== totalTicks) {
        continue;
      }

      const checkpointEvent = simulation.createDeltaEvent(tickId);
      const checkpointMetrics = checkpointEvent.metrics ?? emptyMetrics();
      const checkpoint: StressCheckpoint = {
        tickId,
        gameDay: checkpointEvent.gameTime.day,
        queueDepth: checkpointMetrics.queueDepth,
        queueDropped: checkpointMetrics.queueDropped,
        llmFallbackRate: checkpointMetrics.llmFallbackRate,
        llmQueueBackpressure: checkpointMetrics.llmQueueBackpressure ?? 'normal',
        llmQueueHealthy: checkpointMetrics.llmQueueHealthy ?? true,
        pathCacheHitRate: checkpointMetrics.pathCacheHitRate ?? 0,
      };
      checkpoints.push(checkpoint);

      maxDepthObserved = Math.max(maxDepthObserved, checkpoint.queueDepth);
      maxDroppedObserved = Math.max(maxDroppedObserved, checkpoint.queueDropped);

      if (!checkpoint.llmQueueHealthy) {
        unhealthyCheckpointCount += 1;
        this.recordIssue(issues, {
          tickId,
          type: 'queueUnhealthy',
          severity: checkpoint.llmQueueBackpressure === 'critical' ? 'error' : 'warn',
          message: `LLM queue unhealthy at tick ${tickId} (backpressure=${checkpoint.llmQueueBackpressure})`,
        });
      }

      if (checkpoint.llmQueueBackpressure === 'elevated') {
        elevatedBackpressureCheckpointCount += 1;
      }

      if (checkpoint.llmQueueBackpressure === 'critical') {
        criticalBackpressureCheckpointCount += 1;
      }
    }

    await simulation.waitForIdle();
    const finalSnapshot = simulation.createSnapshotEvent(totalTicks);
    const finalMetrics = finalSnapshot.metrics ?? emptyMetrics();

    return {
      profileName: this.config.profileName,
      durationDaysRequested: this.config.durationDays,
      totalTicks,
      totalGameDays: finalSnapshot.gameTime.day,
      tickTiming: summarizeTickDurations(tickDurations),
      memoryStats: summarizeMemory(heapSamples),
      queueSummary: {
        maxDepthObserved,
        maxDroppedObserved,
        unhealthyCheckpointCount,
        elevatedBackpressureCheckpointCount,
        criticalBackpressureCheckpointCount,
      },
      finalMetrics,
      checkpoints,
      issues,
    };
  }

  private validateConfig(): void {
    if (!Number.isFinite(this.config.durationDays) || this.config.durationDays <= 0) {
      throw new Error(`durationDays must be > 0, got ${this.config.durationDays}`);
    }

    if (!Number.isInteger(this.config.agentCount) || this.config.agentCount <= 0) {
      throw new Error(`agentCount must be a positive integer, got ${this.config.agentCount}`);
    }

    if (!Number.isFinite(this.config.checkpointIntervalMinutes) || this.config.checkpointIntervalMinutes <= 0) {
      throw new Error(`checkpointIntervalMinutes must be > 0, got ${this.config.checkpointIntervalMinutes}`);
    }
  }

  private recordIssue(issues: StressTestIssue[], issue: StressTestIssue): void {
    if (issues.length >= this.config.maxRecordedIssues) {
      return;
    }
    issues.push(issue);
  }
}

function summarizeTickDurations(samples: number[]): TickTimingStats {
  if (samples.length === 0) {
    return {
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
    };
  }

  return {
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    avgMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
  };
}

function summarizeMemory(samples: number[]): { peakHeapUsed: number; averageHeapUsed: number } {
  if (samples.length === 0) {
    return { peakHeapUsed: 0, averageHeapUsed: 0 };
  }

  return {
    peakHeapUsed: Math.max(...samples),
    averageHeapUsed: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  };
}

function percentile(values: number[], percent: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.max(0, Math.min(100, percent));
  const index = Math.min(sorted.length - 1, Math.floor((clamped / 100) * sorted.length));
  return sorted[index];
}

function emptyMetrics(): SimulationMetrics {
  return {
    tickDurationMsP50: 0,
    tickDurationMsP95: 0,
    tickDurationMsP99: 0,
    queueDepth: 0,
    queueDropped: 0,
    llmFallbackRate: 0,
  };
}
