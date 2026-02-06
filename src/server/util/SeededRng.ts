export class SeededRng {
  private state: number;

  constructor(seed = 1) {
    const normalized = seed >>> 0;
    this.state = normalized === 0 ? 1 : normalized;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`maxExclusive must be > 0, got ${maxExclusive}`);
    }

    return Math.floor(this.next() * maxExclusive);
  }

  range(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error(`Invalid range ${minInclusive}..${maxInclusive}`);
    }

    const span = maxInclusive - minInclusive + 1;
    return minInclusive + this.nextInt(span);
  }

  chance(probability: number): boolean {
    if (probability <= 0) {
      return false;
    }
    if (probability >= 1) {
      return true;
    }
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }

    return items[this.nextInt(items.length)];
  }
}
