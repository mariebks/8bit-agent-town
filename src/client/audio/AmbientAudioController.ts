import { GameTime } from '@shared/Types';

export type UiCueKind = 'jump' | 'relationship' | 'conversation' | 'topic';

export class AmbientAudioController {
  private context: AudioContext | null = null;
  private enabled = false;
  private unlocked = false;
  private padOscA: OscillatorNode | null = null;
  private padOscB: OscillatorNode | null = null;
  private padGain: GainNode | null = null;

  bindUnlockGestures(target: Window): void {
    const unlock = async () => {
      await this.ensureContext();
      if (!this.context) {
        return;
      }
      try {
        await this.context.resume();
      } catch {
        return;
      }
      this.unlocked = true;
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('keydown', unlock);
      if (this.enabled) {
        this.ensurePad();
      }
    };

    target.addEventListener('pointerdown', unlock, { once: true });
    target.addEventListener('keydown', unlock, { once: true });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async toggleEnabled(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (this.enabled) {
      await this.ensureContext();
      if (this.unlocked) {
        this.ensurePad();
      }
    } else {
      this.stopPad();
    }
    return this.enabled;
  }

  async setDayPart(gameTime: GameTime | null): Promise<void> {
    if (!this.enabled || !gameTime || !this.unlocked) {
      return;
    }
    await this.ensureContext();
    this.ensurePad();
    if (!this.context || !this.padOscA || !this.padOscB || !this.padGain) {
      return;
    }

    const now = this.context.currentTime;
    const target = resolveDayPartProfile(gameTime.hour);
    this.padOscA.frequency.setTargetAtTime(target.freqA, now, 1.4);
    this.padOscB.frequency.setTargetAtTime(target.freqB, now, 1.4);
    this.padGain.gain.setTargetAtTime(target.gain, now, 1.2);
  }

  async playCue(kind: UiCueKind): Promise<void> {
    if (!this.enabled || !this.unlocked) {
      return;
    }
    await this.ensureContext();
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const tone = this.context.createOscillator();
    const gain = this.context.createGain();

    tone.type = 'triangle';
    const { start, end, level } = resolveCue(kind);
    tone.frequency.setValueAtTime(start, now);
    tone.frequency.exponentialRampToValueAtTime(end, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    tone.connect(gain);
    gain.connect(this.context.destination);

    tone.start(now);
    tone.stop(now + 0.28);
  }

  private async ensureContext(): Promise<void> {
    if (this.context) {
      return;
    }

    const ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctor) {
      return;
    }

    this.context = new ctor();
  }

  private ensurePad(): void {
    if (!this.context || this.padGain) {
      return;
    }

    this.padOscA = this.context.createOscillator();
    this.padOscB = this.context.createOscillator();
    this.padGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    this.padOscA.type = 'sine';
    this.padOscB.type = 'triangle';
    this.padOscA.frequency.value = 110;
    this.padOscB.frequency.value = 146.83;
    this.padGain.gain.value = 0.02;
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.7;

    this.padOscA.connect(this.padGain);
    this.padOscB.connect(this.padGain);
    this.padGain.connect(filter);
    filter.connect(this.context.destination);

    this.padOscA.start();
    this.padOscB.start();
  }

  private stopPad(): void {
    this.padOscA?.stop();
    this.padOscB?.stop();
    this.padOscA?.disconnect();
    this.padOscB?.disconnect();
    this.padGain?.disconnect();
    this.padOscA = null;
    this.padOscB = null;
    this.padGain = null;
  }
}

export function resolveDayPartProfile(hour: number): { freqA: number; freqB: number; gain: number } {
  if (hour < 6) {
    return { freqA: 92.5, freqB: 123.47, gain: 0.015 };
  }
  if (hour < 12) {
    return { freqA: 110, freqB: 146.83, gain: 0.018 };
  }
  if (hour < 18) {
    return { freqA: 123.47, freqB: 164.81, gain: 0.02 };
  }
  return { freqA: 98, freqB: 130.81, gain: 0.017 };
}

export function resolveCue(kind: UiCueKind): { start: number; end: number; level: number } {
  if (kind === 'relationship') {
    return { start: 520, end: 780, level: 0.06 };
  }
  if (kind === 'topic') {
    return { start: 460, end: 620, level: 0.05 };
  }
  if (kind === 'conversation') {
    return { start: 430, end: 560, level: 0.04 };
  }
  return { start: 480, end: 680, level: 0.05 };
}
