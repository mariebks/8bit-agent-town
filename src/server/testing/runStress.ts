import fs from 'node:fs';
import path from 'node:path';
import { buildDefaultStressProfiles, StressTestConfig, StressTestRunner } from './StressTest';

type ProfileMode = 'baseline' | 'llm' | 'both';

function parseProfileMode(argv: string[]): ProfileMode {
  const profileIndex = argv.indexOf('--profile');
  if (profileIndex === -1 || profileIndex === argv.length - 1) {
    return 'baseline';
  }

  const value = argv[profileIndex + 1];
  if (value === 'baseline' || value === 'llm' || value === 'both') {
    return value;
  }

  throw new Error(`Unsupported profile mode "${value}". Use baseline | llm | both.`);
}

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveProfiles(mode: ProfileMode): StressTestConfig[] {
  const profiles = buildDefaultStressProfiles({
    durationDays: readEnvNumber('STRESS_DAYS', 1),
    agentCount: readEnvNumber('STRESS_AGENT_COUNT', 20),
    seed: readEnvNumber('STRESS_SEED', 42),
    checkpointIntervalMinutes: readEnvNumber('STRESS_CHECKPOINT_MINUTES', 120),
    overrunBudgetMs: readEnvNumber('STRESS_OVERRUN_BUDGET_MS', 220),
    mapPath: process.env.STRESS_MAP_PATH,
  });

  if (mode === 'baseline') {
    return [profiles[0]];
  }

  if (mode === 'llm') {
    return [profiles[1]];
  }

  return profiles;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function main(): Promise<void> {
  const mode = parseProfileMode(process.argv.slice(2));
  const profiles = resolveProfiles(mode);
  const outputDir = path.resolve(process.cwd(), 'output/stress');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const profile of profiles) {
    const startedAt = Date.now();
    const runner = new StressTestRunner(profile);
    const result = await runner.run();
    const elapsedMs = Date.now() - startedAt;

    const outputPath = path.join(outputDir, `${result.profileName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

    // eslint-disable-next-line no-console
    console.log(
      [
        `[stress] profile=${result.profileName}`,
        `ticks=${result.totalTicks}`,
        `days=${result.totalGameDays}`,
        `runtimeMs=${elapsedMs}`,
        `tickP95=${result.tickTiming.p95Ms.toFixed(2)}`,
        `tickP99=${result.tickTiming.p99Ms.toFixed(2)}`,
        `queueMaxDepth=${result.queueSummary.maxDepthObserved}`,
        `issues=${result.issues.length}`,
        `heapPeak=${formatBytes(result.memoryStats.peakHeapUsed)}`,
        `report=${outputPath}`,
      ].join(' '),
    );
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[stress] failed', error);
  process.exitCode = 1;
});
