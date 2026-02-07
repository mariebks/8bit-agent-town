import { afterEach, describe, expect, test, vi } from 'vitest';
import { OllamaClient } from './OllamaClient';

describe('OllamaClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns success payload and records last response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: 'MOVE_TO library' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = new OllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      maxRetries: 1,
      retryDelayMs: 0,
      timeoutMs: 200,
    });

    const result = await client.generate({
      prompt: 'Choose action',
      format: 'json',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.content).toBe('MOVE_TO library');
    expect(result.retries).toBe(0);
    expect(client.getLastResponse()).toEqual(result);
  });

  test('retries retryable transport errors and reports retry count', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fetch failed: connection reset'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: 'WAIT' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = new OllamaClient({
      maxRetries: 1,
      retryDelayMs: 0,
      timeoutMs: 200,
    });

    const result = await client.generate({ prompt: 'Choose action' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.content).toBe('WAIT');
    expect(result.retries).toBe(1);
  });

  test('does not retry non-retryable errors', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = new OllamaClient({
      maxRetries: 3,
      retryDelayMs: 0,
      timeoutMs: 200,
    });

    const result = await client.generate({ prompt: 'Choose action' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Ollama HTTP 400');
    expect(result.retries).toBe(0);
    expect(client.getLastResponse()).toEqual(result);
  });

  test('fails on invalid payload shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ notResponse: 'missing expected field' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = new OllamaClient({
      maxRetries: 0,
      timeoutMs: 200,
    });

    const result = await client.generate({ prompt: 'Choose action' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing "response"');
  });
});
