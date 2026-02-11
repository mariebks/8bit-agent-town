import { AgentState } from '@shared/Types';
import { describe, expect, test } from 'vitest';
import { buildWeatherStatus } from './WeatherStatus';

function agent(mood?: number) {
  return {
    id: 'a1',
    name: 'Ada',
    position: { x: 0, y: 0 },
    tilePosition: { tileX: 0, tileY: 0 },
    state: AgentState.Idle,
    color: 0xffffff,
    mood,
  };
}

describe('WeatherStatus', () => {
  test('renders fallback mood label without mood samples', () => {
    const snapshot = buildWeatherStatus([agent(undefined)], []);
    expect(snapshot.label).toContain('mood n/a');
    expect(snapshot.themeTopic).toBeNull();
  });

  test('reflects latest topic as weather theme context', () => {
    const snapshot = buildWeatherStatus([agent(20), agent(30)], ['harvest news', 'storm warning']);
    expect(snapshot.moodAverage).toBe(25);
    expect(snapshot.themeTopic).toBe('storm warning');
    expect(snapshot.label).toContain('mood 25');
  });
});
