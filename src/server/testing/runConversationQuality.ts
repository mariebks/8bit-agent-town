import fs from 'node:fs';
import path from 'node:path';
import { GAME_MINUTES_PER_TICK } from '@shared/Constants';
import { ConversationTurnEvent } from '@shared/Events';
import { Simulation } from '../simulation/Simulation';
import { loadTownMap } from '../world/MapLoader';
import { ConversationQualityReport, scoreConversationQuality } from './ConversationQuality';

const MINUTES_PER_DAY = 24 * 60;

const DEFAULT_DAYS = 1;
const DEFAULT_AGENT_COUNT = 20;
const DEFAULT_SEED = 42;
const DEFAULT_LLM_ENABLED = true;

const REGRESSION_THRESHOLDS = {
  topicalityScore: -0.05,
  repetitionRate: 0.05,
  memoryReferenceRate: -0.05,
  relationshipConsistencyScore: -0.05,
  uniqueTurnRatio: -0.05,
};

async function main(): Promise<void> {
  const days = readEnvNumber('QUALITY_DAYS', DEFAULT_DAYS);
  const agentCount = readEnvNumber('QUALITY_AGENT_COUNT', DEFAULT_AGENT_COUNT);
  const seed = readEnvNumber('QUALITY_SEED', DEFAULT_SEED);
  const llmEnabled = readEnvBoolean('QUALITY_LLM_ENABLED', DEFAULT_LLM_ENABLED);

  const totalTicks = Math.max(1, Math.floor((days * MINUTES_PER_DAY) / GAME_MINUTES_PER_TICK));
  const mapData = loadTownMap(process.env.QUALITY_MAP_PATH || undefined);
  const simulation = new Simulation(mapData, {
    seed,
    agentCount,
    llmEnabled,
  });

  const turnEvents: ConversationTurnEvent[] = [];
  for (let tickId = 1; tickId <= totalTicks; tickId += 1) {
    simulation.tick(tickId);
    const delta = simulation.createDeltaEvent(tickId);
    for (const event of delta.events ?? []) {
      const turn = asConversationTurn(event);
      if (turn) {
        turnEvents.push(turn);
      }
    }
  }

  await simulation.waitForIdle();
  const snapshot = simulation.createSnapshotEvent(totalTicks);
  const metrics = scoreConversationQuality(turnEvents, snapshot.agents);

  const report: ConversationQualityReport = {
    generatedAt: new Date().toISOString(),
    config: {
      ticks: totalTicks,
      days,
      seed,
      agentCount,
      llmEnabled,
    },
    metrics,
  };

  const outputDir = path.resolve(process.cwd(), 'output/quality');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = Date.now();
  const reportPath = path.join(outputDir, `conversation-quality-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');

  if (readEnvBoolean('QUALITY_WRITE_BASELINE', false)) {
    fs.writeFileSync(path.join(outputDir, 'baseline.json'), JSON.stringify(report, null, 2), 'utf8');
  }

  const baselinePath = path.join(outputDir, 'baseline.json');
  const baseline = readBaselineReport(baselinePath);
  const summary = buildSummaryMarkdown(report, baseline, reportPath);
  const summaryPath = path.join(outputDir, 'latest-summary.md');
  fs.writeFileSync(summaryPath, summary, 'utf8');

  const thresholdStatus = baseline ? evaluateThresholds(report, baseline) : null;

  // eslint-disable-next-line no-console
  console.log(
    [
      `[quality] turns=${metrics.totalTurns}`,
      `conversations=${metrics.conversationCount}`,
      `topicality=${metrics.topicalityScore.toFixed(3)}`,
      `repetition=${(metrics.repetitionRate * 100).toFixed(1)}%`,
      `memoryRefs=${(metrics.memoryReferenceRate * 100).toFixed(1)}%`,
      `relationship=${metrics.relationshipConsistencyScore.toFixed(3)}`,
      `unique=${(metrics.uniqueTurnRatio * 100).toFixed(1)}%`,
      `report=${reportPath}`,
      `summary=${summaryPath}`,
      thresholdStatus ? `thresholds=${thresholdStatus.passed ? 'pass' : 'fail'}` : 'thresholds=n/a',
    ].join(' '),
  );

  if (thresholdStatus && !thresholdStatus.passed && readEnvBoolean('QUALITY_ENFORCE', false)) {
    process.exitCode = 1;
  }
}

function readBaselineReport(pathname: string): ConversationQualityReport | null {
  if (!fs.existsSync(pathname)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(pathname, 'utf8');
    return JSON.parse(raw) as ConversationQualityReport;
  } catch {
    return null;
  }
}

function evaluateThresholds(current: ConversationQualityReport, baseline: ConversationQualityReport): {
  passed: boolean;
  deltas: Record<keyof typeof REGRESSION_THRESHOLDS, number>;
} {
  const deltas = {
    topicalityScore: current.metrics.topicalityScore - baseline.metrics.topicalityScore,
    repetitionRate: current.metrics.repetitionRate - baseline.metrics.repetitionRate,
    memoryReferenceRate: current.metrics.memoryReferenceRate - baseline.metrics.memoryReferenceRate,
    relationshipConsistencyScore: current.metrics.relationshipConsistencyScore - baseline.metrics.relationshipConsistencyScore,
    uniqueTurnRatio: current.metrics.uniqueTurnRatio - baseline.metrics.uniqueTurnRatio,
  };

  const passed =
    deltas.topicalityScore >= REGRESSION_THRESHOLDS.topicalityScore &&
    deltas.repetitionRate <= REGRESSION_THRESHOLDS.repetitionRate &&
    deltas.memoryReferenceRate >= REGRESSION_THRESHOLDS.memoryReferenceRate &&
    deltas.relationshipConsistencyScore >= REGRESSION_THRESHOLDS.relationshipConsistencyScore &&
    deltas.uniqueTurnRatio >= REGRESSION_THRESHOLDS.uniqueTurnRatio;

  return { passed, deltas };
}

function buildSummaryMarkdown(
  report: ConversationQualityReport,
  baseline: ConversationQualityReport | null,
  reportPath: string,
): string {
  const lines = [
    '# Conversation Quality Summary',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Config: days=${report.config.days}, ticks=${report.config.ticks}, agentCount=${report.config.agentCount}, llmEnabled=${report.config.llmEnabled}`,
    `- Report: ${reportPath}`,
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| totalTurns | ${report.metrics.totalTurns} |`,
    `| conversationCount | ${report.metrics.conversationCount} |`,
    `| topicalityScore | ${report.metrics.topicalityScore.toFixed(4)} |`,
    `| repetitionRate | ${(report.metrics.repetitionRate * 100).toFixed(2)}% |`,
    `| memoryReferenceRate | ${(report.metrics.memoryReferenceRate * 100).toFixed(2)}% |`,
    `| relationshipConsistencyScore | ${report.metrics.relationshipConsistencyScore.toFixed(4)} |`,
    `| uniqueTurnRatio | ${(report.metrics.uniqueTurnRatio * 100).toFixed(2)}% |`,
    '',
  ];

  if (baseline) {
    const status = evaluateThresholds(report, baseline);
    lines.push('## Delta vs Baseline');
    lines.push('');
    lines.push(`- Baseline generated: ${baseline.generatedAt}`);
    lines.push(`- Threshold result: ${status.passed ? 'PASS' : 'FAIL'}`);
    lines.push('');
    lines.push('| Metric | Delta | Threshold |');
    lines.push('|---|---:|---:|');
    lines.push(`| topicalityScore | ${status.deltas.topicalityScore.toFixed(4)} | >= ${REGRESSION_THRESHOLDS.topicalityScore} |`);
    lines.push(`| repetitionRate | ${status.deltas.repetitionRate.toFixed(4)} | <= ${REGRESSION_THRESHOLDS.repetitionRate} |`);
    lines.push(
      `| memoryReferenceRate | ${status.deltas.memoryReferenceRate.toFixed(4)} | >= ${REGRESSION_THRESHOLDS.memoryReferenceRate} |`,
    );
    lines.push(
      `| relationshipConsistencyScore | ${status.deltas.relationshipConsistencyScore.toFixed(4)} | >= ${REGRESSION_THRESHOLDS.relationshipConsistencyScore} |`,
    );
    lines.push(`| uniqueTurnRatio | ${status.deltas.uniqueTurnRatio.toFixed(4)} | >= ${REGRESSION_THRESHOLDS.uniqueTurnRatio} |`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function asConversationTurn(event: unknown): ConversationTurnEvent | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const typed = event as Record<string, unknown>;
  if (typed.type !== 'conversationTurn') {
    return null;
  }
  if (typeof typed.conversationId !== 'string' || typeof typed.speakerId !== 'string' || typeof typed.message !== 'string') {
    return null;
  }

  return typed as ConversationTurnEvent;
}

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readEnvBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return raw === '1' || raw.toLowerCase() === 'true';
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[quality] failed', error);
  process.exitCode = 1;
});
