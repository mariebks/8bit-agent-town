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

interface RequestQueueOptions {
  concurrency?: number;
  now?: () => number;
}

export class RequestQueue {
  private readonly queue: PQueue;
  private readonly now: () => number;
  private droppedCount = 0;

  constructor(options: RequestQueueOptions = {}) {
    this.queue = new PQueue({ concurrency: options.concurrency ?? 1 });
    this.now = options.now ?? (() => Date.now());
  }

  async enqueue<T>(task: QueueTask<T>): Promise<QueueOutcome<T>> {
    const createdAtMs = task.createdAtMs ?? this.now();

    const result = await this.queue.add(
      async () => {
        if (this.now() - createdAtMs > task.ttlMs) {
          this.droppedCount += 1;
          return {
            status: 'dropped',
            error: `Dropped stale request ${task.id}`,
          } as QueueOutcome<T>;
        }

        try {
          const value = await task.execute();
          return {
            status: 'ok',
            value,
          } as QueueOutcome<T>;
        } catch (error) {
          return {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          } as QueueOutcome<T>;
        }
      },
      { priority: task.priority },
    );

    if (!result) {
      this.droppedCount += 1;
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

  async onIdle(): Promise<void> {
    await this.queue.onIdle();
  }
}
