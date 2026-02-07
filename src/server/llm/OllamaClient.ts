export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  temperature: number;
  debug: boolean;
}

export interface OllamaRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  format?: 'json' | 'text';
}

export interface OllamaResponse {
  success: boolean;
  content?: string;
  error?: string;
  latencyMs: number;
  retries: number;
}

export class OllamaClient {
  private readonly config: OllamaConfig;
  private lastResponse: OllamaResponse | null = null;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://127.0.0.1:11434',
      model: config.model ?? 'llama3.2:3b',
      timeoutMs: config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 1,
      retryDelayMs: config.retryDelayMs ?? 500,
      temperature: config.temperature ?? 0.3,
      debug: config.debug ?? false,
    };
  }

  getLastResponse(): OllamaResponse | null {
    return this.lastResponse;
  }

  async generate(request: OllamaRequest): Promise<OllamaResponse> {
    const startedAt = Date.now();
    let retries = 0;
    let lastError = 'Unknown error';

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const content = await this.makeRequest(request);
        const response: OllamaResponse = {
          success: true,
          content,
          latencyMs: Date.now() - startedAt,
          retries: attempt,
        };
        this.lastResponse = response;
        return response;
      } catch (error) {
        retries = attempt;
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < this.config.maxRetries && this.isRetryableError(lastError)) {
          await this.sleep(this.config.retryDelayMs);
          continue;
        }

        break;
      }
    }

    const failed: OllamaResponse = {
      success: false,
      error: lastError,
      latencyMs: Date.now() - startedAt,
      retries,
    };
    this.lastResponse = failed;
    return failed;
  }

  private async makeRequest(request: OllamaRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: false,
          format: request.format === 'json' ? 'json' : undefined,
          options: {
            temperature: request.temperature ?? this.config.temperature,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { response?: string };
      if (typeof payload.response !== 'string' || payload.response.length === 0) {
        throw new Error('Ollama response payload missing "response"');
      }

      if (this.config.debug) {
        const logText = payload.response.length > 200 ? `${payload.response.slice(0, 200)}...` : payload.response;
        // eslint-disable-next-line no-console
        console.log('[ollama] response snippet:', logText);
      }

      return payload.response;
    } finally {
      clearTimeout(timer);
    }
  }

  private isRetryableError(message: string): boolean {
    return (
      message.includes('fetch failed') ||
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('aborted') ||
      message.includes('HTTP 5')
    );
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
