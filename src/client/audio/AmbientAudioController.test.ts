import { describe, expect, test } from 'vitest';
import { AmbientAudioController, resolveCue, resolveDayPartProfile } from './AmbientAudioController';

describe('AmbientAudioController', () => {
  test('maps day parts to distinct ambient profiles', () => {
    const night = resolveDayPartProfile(2);
    const morning = resolveDayPartProfile(9);
    const afternoon = resolveDayPartProfile(14);
    const evening = resolveDayPartProfile(20);

    expect(night.freqA).not.toBe(morning.freqA);
    expect(morning.freqA).not.toBe(afternoon.freqA);
    expect(evening.freqB).not.toBe(afternoon.freqB);
  });

  test('maps cue kinds to positive ramped tones', () => {
    const jump = resolveCue('jump');
    const relationship = resolveCue('relationship');

    expect(jump.start).toBeGreaterThan(0);
    expect(relationship.end).toBeGreaterThan(relationship.start);
    expect(relationship.level).toBeGreaterThan(0);
  });

  test('can toggle enabled state without throwing when WebAudio is unavailable', async () => {
    const controller = new AmbientAudioController();
    expect(controller.isEnabled()).toBe(false);
    await expect(controller.toggleEnabled()).resolves.toBe(true);
    await expect(controller.toggleEnabled()).resolves.toBe(false);
  });
});
