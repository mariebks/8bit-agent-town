import PQueue from 'p-queue';

export type QueuePriority = 0 | 1 | 2 | 3;

export interface QueueTask<T> {
  id: string;
  priority: QueuePriority;
  ttlMs: number;
  createdAtMs?: number;
  execute: () => Promise<T>;
}

export interface QueueOutcome<T> {
  status: 'ok' | 'dropped' | 'failed';
  value?: T;
  error?: string;
}

export interface QueueMetrics {
  currentSize: number;
  pending: number;
  maxSizeReached: number;
  totalProcessed: number;
  totalDropped: number;
  averageWaitTimeMs: number;
  averageProcessTimeMs: number;
  timeoutsCount: number;
  failuresCount: number;
}

export type BackpressureLevel = 'normal' | 'elevated' | 'critical';

interface RequestQueueOptions {
  concurrency?: number;
  now?: () => number;
  elevatedThreshold?: number;
  criticalThreshold?: number;
}

export class RequestQueue {
  private readonly queue: PQueue;
  private readonly now: () => number;
  private readonly elevatedThreshold: number;
  private readonly criticalThreshold: number;
  private droppedCount = 0;
  private maxSizeReached = 0;
  private totalProcessed = 0;
  private totalDropped = 0;
  private timeoutsCount = 0;
  private failuresCount = 0;
  private totalWaitMs = 0;
  private totalProcessMs = 0;
  private executedCount = 0;

  constructor(options: RequestQueueOptions = {}) {
    this.queue = new PQueue({ concurrency: options.concurrency ?? 1 });
    this.now = options.now ?? (() => Date.now());
    this.elevatedThreshold = Math.max(1, options.elevatedThreshold ?? 20);
    this.criticalThreshold = Math.max(this.elevatedThreshold + 1, options.criticalThreshold ?? 40);
  }

  async enqueue<T>(task: QueueTask<T>): Promise<QueueOutcome<T>> {
    const createdAtMs = task.createdAtMs ?? this.now();
    const enqueuedAtMs = this.now();
    const queuedPromise = this.queue.add(
      async () => {
        const startedAtMs = this.now();
        const waitMs = Math.max(0, startedAtMs - enqueuedAtMs);
        this.totalWaitMs += waitMs;

        if (this.now() - createdAtMs > task.ttlMs) {
          this.totalProcessed += 1;
          this.droppedCount += 1;
          this.totalDropped += 1;
          this.timeoutsCount += 1;
          return {
            status: 'dropped',
            error: `Dropped stale request ${task.id}`,
          } as QueueOutcome<T>;
        }

        try {
          const value = await task.execute();
          this.totalProcessed += 1;
          this.executedCount += 1;
          this.totalProcessMs += Math.max(0, this.now() - startedAtMs);
          return {
            status: 'ok',
            value,
          } as QueueOutcome<T>;
        } catch (error) {
          this.totalProcessed += 1;
          this.executedCount += 1;
          this.failuresCount += 1;
          this.totalProcessMs += Math.max(0, this.now() - startedAtMs);
          return {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          } as QueueOutcome<T>;
        }
      },
      { priority: task.priority },
    );
    this.updateMaxSize();

    const result = await queuedPromise;

    if (!result) {
      this.totalProcessed += 1;
      this.droppedCount += 1;
      this.totalDropped += 1;
      return {
        status: 'dropped',
        error: `Dropped request ${task.id} because queue returned empty result`,
      };
    }

    return result;
  }

  size(): number {
    return this.queue.size;
  }

  pending(): number {
    return this.queue.pending;
  }

  dropped(): number {
    return this.droppedCount;
  }

  getMetrics(): QueueMetrics {
    return {
      currentSize: this.size(),
      pending: this.pending(),
      maxSizeReached: this.maxSizeReached,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      averageWaitTimeMs: this.totalProcessed > 0 ? this.totalWaitMs / this.totalProcessed : 0,
      averageProcessTimeMs: this.executedCount > 0 ? this.totalProcessMs / this.executedCount : 0,
      timeoutsCount: this.timeoutsCount,
      failuresCount: this.failuresCount,
    };
  }

  getBackpressureLevel(): BackpressureLevel {
    const load = this.size() + this.pending();
    if (load >= this.criticalThreshold) {
      return 'critical';
    }
    if (load >= this.elevatedThreshold) {
      return 'elevated';
    }
    return 'normal';
  }

  isHealthy(): boolean {
    const level = this.getBackpressureLevel();
    if (level === 'critical') {
      return false;
    }

    const metrics = this.getMetrics();
    if (metrics.totalProcessed < 20) {
      return true;
    }

    const dropRate = metrics.totalDropped / Math.max(1, metrics.totalProcessed);
    return dropRate < 0.4;
  }

  async onIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  private updateMaxSize(): void {
    const load = this.size() + this.pending();
    if (load > this.maxSizeReached) {
      this.maxSizeReached = load;
    }
  }
}
