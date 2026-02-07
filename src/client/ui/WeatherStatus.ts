import { AgentData } from '@shared/Types';
import { resolveWeatherProfile } from '../game/scenes/WeatherProfile';

export interface WeatherStatusSnapshot {
  label: string;
  moodAverage: number | null;
  rainIntensity: number;
  themeTopic: string | null;
}

export function buildWeatherStatus(agents: AgentData[], recentTopics: string[]): WeatherStatusSnapshot {
  const moodAverage = computeAverageMood(agents);
  const profile = resolveWeatherProfile(moodAverage, recentTopics);
  const themeTopic = recentTopics.length > 0 ? recentTopics[recentTopics.length - 1] : null;
  const moodText = moodAverage === null ? 'n/a' : String(Math.round(moodAverage));
  return {
    label: `${profile.kind.toUpperCase()} | mood ${moodText}`,
    moodAverage,
    rainIntensity: profile.rainIntensity,
    themeTopic,
  };
}

function computeAverageMood(agents: AgentData[]): number | null {
  const moods = agents.map((agent) => agent.mood).filter((value): value is number => typeof value === 'number');
  if (moods.length === 0) {
    return null;
  }
  return moods.reduce((sum, value) => sum + value, 0) / moods.length;
}
