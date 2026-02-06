export class RollingStats {
  private readonly capacity: number;
  private samples: number[] = [];

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  push(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.capacity) {
      this.samples = this.samples.slice(this.samples.length - this.capacity);
    }
  }

  percentile(percentile: number): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const clamped = Math.max(0, Math.min(100, percentile));
    const index = Math.min(sorted.length - 1, Math.floor((clamped / 100) * sorted.length));
    return sorted[index];
  }
}
