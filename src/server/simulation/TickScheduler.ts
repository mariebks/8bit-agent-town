import { TICK_INTERVAL_MS } from '@shared/Constants';

type TimerHandle = ReturnType<typeof setTimeout>;

type TickCallback = (tickId: number) => void;

interface TickSchedulerOptions {
  tickIntervalMs?: number;
  maxCatchUpTicks?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}

export class TickScheduler {
  private readonly tickIntervalMs: number;
  private readonly maxCatchUpTicks: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;

  private tickId = 0;
  private running = false;
  private accumulatedMs = 0;
  private lastTickTime = 0;
  private timerHandle: TimerHandle | null = null;

  private readonly tickCallbacks = new Set<TickCallback>();

  constructor(options: TickSchedulerOptions = {}) {
    this.tickIntervalMs = options.tickIntervalMs ?? TICK_INTERVAL_MS;
    this.maxCatchUpTicks = options.maxCatchUpTicks ?? 5;
    this.now = options.now ?? (() => performance.now());
    this.setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.accumulatedMs = 0;
    this.lastTickTime = this.now();
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timerHandle) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  onTick(callback: TickCallback): () => void {
    this.tickCallbacks.add(callback);
    return () => this.tickCallbacks.delete(callback);
  }

  getCurrentTickId(): number {
    return this.tickId;
  }

  processElapsed(elapsedMs: number): number {
    this.accumulatedMs += elapsedMs;

    let processedTicks = 0;
    while (this.accumulatedMs >= this.tickIntervalMs && processedTicks < this.maxCatchUpTicks) {
      this.tickId += 1;
      processedTicks += 1;
      this.accumulatedMs -= this.tickIntervalMs;

      for (const callback of this.tickCallbacks) {
        callback(this.tickId);
      }
    }

    if (processedTicks >= this.maxCatchUpTicks && this.accumulatedMs >= this.tickIntervalMs) {
      this.accumulatedMs = this.tickIntervalMs - 1;
    }

    return processedTicks;
  }

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }

    this.timerHandle = this.setTimer(() => {
      this.timerHandle = null;
      this.runLoop();
    }, this.tickIntervalMs);
  }

  private runLoop(): void {
    if (!this.running) {
      return;
    }

    const now = this.now();
    const elapsed = now - this.lastTickTime;
    this.lastTickTime = now;
    this.processElapsed(elapsed);
    this.scheduleNext();
  }
}
