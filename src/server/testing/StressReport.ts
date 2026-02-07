import { StressTestResults } from './StressTest';

export function buildStressSummaryReport(results: StressTestResults[]): string {
  if (results.length === 0) {
    return '# Stress Test Summary\n\nNo profiles were executed.\n';
  }

  const lines: string[] = [
    '# Stress Test Summary',
    '',
    '| Profile | Days | Ticks | Tick p95 (ms) | Tick p99 (ms) | Queue Max Depth | Fallback Rate | Peak Heap | Issues |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];

  for (const result of results) {
    lines.push(
      [
        `| ${result.profileName}`,
        `${result.totalGameDays}`,
        `${result.totalTicks}`,
        `${result.tickTiming.p95Ms.toFixed(2)}`,
        `${result.tickTiming.p99Ms.toFixed(2)}`,
        `${result.queueSummary.maxDepthObserved}`,
        `${(result.finalMetrics.llmFallbackRate * 100).toFixed(1)}%`,
        `${formatBytes(result.memoryStats.peakHeapUsed)}`,
        `${result.issues.length} |`,
      ].join(' | '),
    );
  }

  lines.push('');
  lines.push('## Notes');
  for (const result of results) {
    const critical = result.issues.filter((issue) => issue.severity === 'error').length;
    lines.push(
      `- ${result.profileName}: checkpoints=${result.checkpoints.length}, unhealthyCheckpoints=${result.queueSummary.unhealthyCheckpointCount}, criticalIssues=${critical}`,
    );
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
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
