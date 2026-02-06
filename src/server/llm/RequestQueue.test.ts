import { describe, expect, test } from 'vitest';
import { RequestQueue } from './RequestQueue';

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

    // Fresh task should execute
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
});
