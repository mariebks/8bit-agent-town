import { describe, expect, test } from 'vitest';
import { RequestQueue } from './RequestQueue';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('RequestQueue', () => {
  test('drops stale tasks before execution', async () => {
    let now = 10_000;
    const queue = new RequestQueue({
      now: () => now,
      concurrency: 1,
    });

    const result = await queue.enqueue({
      id: 'stale-task',
      priority: 1,
      ttlMs: 10,
      createdAtMs: now,
      execute: async () => 42,
    });

    expect(result.status).toBe('ok');

    now += 100;

    const stale = await queue.enqueue({
      id: 'stale-task-2',
      priority: 1,
      ttlMs: 20,
      createdAtMs: now - 100,
      execute: async () => 77,
    });

    expect(stale.status).toBe('dropped');
    expect(queue.dropped()).toBeGreaterThanOrEqual(1);
  });

  test('returns failed for thrown task errors', async () => {
    const queue = new RequestQueue();

    const failed = await queue.enqueue({
      id: 'throws',
      priority: 0,
      ttlMs: 1000,
      execute: async () => {
        throw new Error('boom');
      },
    });

    expect(failed.status).toBe('failed');
    expect(failed.error).toContain('boom');
  });

  test('tracks queue metrics and backpressure under load', async () => {
    let now = 0;
    const firstGate = createDeferred<number>();

    const queue = new RequestQueue({
      now: () => now,
      concurrency: 1,
      elevatedThreshold: 2,
      criticalThreshold: 4,
    });

    const first = queue.enqueue({
      id: 'first',
      priority: 1,
      ttlMs: 1000,
      execute: () => firstGate.promise,
    });

    const second = queue.enqueue({
      id: 'second',
      priority: 1,
      ttlMs: 1000,
      execute: async () => {
        now += 5;
        return 2;
      },
    });

    const third = queue.enqueue({
      id: 'third',
      priority: 1,
      ttlMs: 1000,
      execute: async () => {
        now += 5;
        return 3;
      },
    });

    const fourth = queue.enqueue({
      id: 'fourth',
      priority: 1,
      ttlMs: 1000,
      execute: async () => {
        now += 5;
        throw new Error('boom');
      },
    });

    await Promise.resolve();
    expect(queue.getBackpressureLevel()).toBe('critical');
    expect(queue.isHealthy()).toBe(false);

    now += 20;
    firstGate.resolve(1);
    const results = await Promise.all([first, second, third, fourth]);
    expect(results.map((entry) => entry.status)).toEqual(['ok', 'ok', 'ok', 'failed']);

    const metrics = queue.getMetrics();
    expect(metrics.maxSizeReached).toBeGreaterThanOrEqual(4);
    expect(metrics.totalProcessed).toBe(4);
    expect(metrics.totalDropped).toBe(0);
    expect(metrics.failuresCount).toBe(1);
    expect(metrics.averageWaitTimeMs).toBeGreaterThan(0);
    expect(metrics.averageProcessTimeMs).toBeGreaterThan(0);
    expect(queue.getBackpressureLevel()).toBe('normal');
  });

  test('reports unhealthy when sustained drop rate is high', async () => {
    let now = 10_000;
    const queue = new RequestQueue({
      now: () => now,
      concurrency: 1,
      elevatedThreshold: 5,
      criticalThreshold: 8,
    });

    for (let i = 0; i < 25; i += 1) {
      if (i % 2 === 0) {
        await queue.enqueue({
          id: `ok-${i}`,
          priority: 1,
          ttlMs: 1000,
          createdAtMs: now,
          execute: async () => {
            now += 1;
            return i;
          },
        });
      } else {
        await queue.enqueue({
          id: `stale-${i}`,
          priority: 1,
          ttlMs: 10,
          createdAtMs: now - 1000,
          execute: async () => i,
        });
      }
    }

    const metrics = queue.getMetrics();
    expect(metrics.totalProcessed).toBe(25);
    expect(metrics.totalDropped).toBeGreaterThanOrEqual(12);
    expect(metrics.timeoutsCount).toBe(metrics.totalDropped);
    expect(queue.isHealthy()).toBe(false);
  });
});
