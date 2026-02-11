export class TimeControlsStatus {
  private transientMessage: string | null = null;
  private transientExpiresAt = 0;

  constructor(
    private readonly nowMs: () => number = () => Date.now(),
    private readonly transientDurationMs = 1500,
  ) {}

  setTransient(message: string): void {
    this.transientMessage = message;
    this.transientExpiresAt = this.nowMs() + this.transientDurationMs;
  }

  resolve(baseMessage: string): string {
    if (this.transientMessage && this.nowMs() < this.transientExpiresAt) {
      return this.transientMessage;
    }

    this.transientMessage = null;
    this.transientExpiresAt = 0;
    return baseMessage;
  }
}

