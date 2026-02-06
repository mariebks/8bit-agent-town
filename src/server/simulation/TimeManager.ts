import { GAME_MINUTES_PER_TICK } from '@shared/Constants';
import { GameTime } from '@shared/Types';

const MINUTES_PER_DAY = 24 * 60;

export type SimulationSpeed = 1 | 2 | 4 | 10;

export class TimeManager {
  private currentGameMinutes: number;
  private speedMultiplier: SimulationSpeed;
  private paused: boolean;
  private readonly dayBoundaryCallbacks = new Set<(gameTime: GameTime) => void>();

  constructor(initialTotalMinutes = 0) {
    this.currentGameMinutes = Math.max(0, Math.floor(initialTotalMinutes));
    this.speedMultiplier = 1;
    this.paused = false;
  }

  tick(ticksElapsed = 1): void {
    if (this.paused || ticksElapsed <= 0) {
      return;
    }

    const minutesToAdvance = ticksElapsed * GAME_MINUTES_PER_TICK * this.speedMultiplier;
    const previousDay = Math.floor(this.currentGameMinutes / MINUTES_PER_DAY);
    this.currentGameMinutes += minutesToAdvance;
    const currentDay = Math.floor(this.currentGameMinutes / MINUTES_PER_DAY);

    if (currentDay <= previousDay) {
      return;
    }

    for (let day = previousDay + 1; day <= currentDay; day += 1) {
      const dayBoundaryTime: GameTime = {
        day,
        hour: 0,
        minute: 0,
        totalMinutes: day * MINUTES_PER_DAY,
      };

      for (const callback of this.dayBoundaryCallbacks) {
        callback(dayBoundaryTime);
      }
    }
  }

  getGameTime(): GameTime {
    const totalMinutes = Math.max(0, Math.floor(this.currentGameMinutes));
    const day = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const dayMinutes = totalMinutes % MINUTES_PER_DAY;
    const hour = Math.floor(dayMinutes / 60);
    const minute = dayMinutes % 60;

    return {
      day,
      hour,
      minute,
      totalMinutes,
    };
  }

  setSpeed(multiplier: SimulationSpeed): void {
    this.speedMultiplier = multiplier;
  }

  getSpeed(): SimulationSpeed {
    return this.speedMultiplier;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  onDayBoundary(callback: (gameTime: GameTime) => void): () => void {
    this.dayBoundaryCallbacks.add(callback);
    return () => this.dayBoundaryCallbacks.delete(callback);
  }
}
