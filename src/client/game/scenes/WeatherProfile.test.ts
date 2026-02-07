import { describe, expect, test } from 'vitest';
import { resolveWeatherProfile } from './WeatherProfile';

describe('WeatherProfile', () => {
  test('returns storm for severe mood/topic signals', () => {
    const profile = resolveWeatherProfile(18, ['storm warning', 'conflict at market']);
    expect(profile.kind).toBe('storm');
    expect(profile.rainIntensity).toBeGreaterThan(0.9);
  });

  test('returns drizzle for moderate negative signals', () => {
    const profile = resolveWeatherProfile(32, ['rain rumor']);
    expect(profile.kind).toBe('drizzle');
    expect(profile.rainIntensity).toBeGreaterThan(0.5);
  });

  test('returns clear weather for positive mood and upbeat topics', () => {
    const profile = resolveWeatherProfile(80, ['festival planning', 'harvest prep']);
    expect(profile.kind).toBe('clear');
    expect(profile.rainIntensity).toBe(0);
  });
});
