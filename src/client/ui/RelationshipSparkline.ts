const SPARK_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function appendRelationshipSample(samples: number[], value: number, maxSamples = 24): number[] {
  const next = [...samples, clampRelationshipValue(value)];
  if (next.length <= maxSamples) {
    return next;
  }
  return next.slice(next.length - maxSamples);
}

export function renderRelationshipSparkline(samples: number[], width = 12): string {
  if (samples.length === 0) {
    return 'n/a';
  }

  const points = resample(samples, width);
  return points
    .map((value) => {
      const normalized = (value + 100) / 200;
      const index = Math.max(0, Math.min(SPARK_BLOCKS.length - 1, Math.round(normalized * (SPARK_BLOCKS.length - 1))));
      return SPARK_BLOCKS[index];
    })
    .join('');
}

function resample(values: number[], width: number): number[] {
  if (values.length <= width) {
    return values;
  }

  const out: number[] = [];
  const step = values.length / width;
  for (let index = 0; index < width; index += 1) {
    const start = Math.floor(index * step);
    const end = Math.max(start + 1, Math.floor((index + 1) * step));
    const window = values.slice(start, end);
    const average = window.reduce((sum, value) => sum + value, 0) / window.length;
    out.push(average);
  }
  return out;
}

function clampRelationshipValue(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}
