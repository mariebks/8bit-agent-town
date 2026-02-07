export type WeatherKind = 'clear' | 'cloudy' | 'drizzle' | 'storm';

export interface WeatherProfile {
  kind: WeatherKind;
  tintColor: number;
  tintAlphaBoost: number;
  rainIntensity: number;
}

const GLOOMY_TOPIC_HINTS = ['conflict', 'rival', 'fight', 'warning', 'shortage', 'gloom', 'problem'];
const RAIN_TOPIC_HINTS = ['rain', 'storm', 'flood', 'thunder', 'cold', 'shelter'];
const SUNNY_TOPIC_HINTS = ['festival', 'sun', 'market', 'celebrate', 'picnic', 'harvest'];

export function resolveWeatherProfile(averageMood: number | null, recentTopics: string[]): WeatherProfile {
  const normalizedMood = averageMood === null ? 50 : Math.max(0, Math.min(100, averageMood));
  const topicScore = scoreTopics(recentTopics);

  if (topicScore <= -3 || normalizedMood < 22) {
    return {
      kind: 'storm',
      tintColor: 0x243346,
      tintAlphaBoost: 0.09,
      rainIntensity: 1,
    };
  }

  if (topicScore <= -1 || normalizedMood < 36) {
    return {
      kind: 'drizzle',
      tintColor: 0x3c5067,
      tintAlphaBoost: 0.06,
      rainIntensity: 0.66,
    };
  }

  if (topicScore === 0 || normalizedMood < 54) {
    return {
      kind: 'cloudy',
      tintColor: 0x5d6872,
      tintAlphaBoost: 0.03,
      rainIntensity: 0,
    };
  }

  return {
    kind: 'clear',
    tintColor: 0xffffff,
    tintAlphaBoost: 0,
    rainIntensity: 0,
  };
}

function scoreTopics(topics: string[]): number {
  let score = 0;
  for (const topic of topics) {
    const normalized = topic.toLowerCase();
    if (includesAny(normalized, RAIN_TOPIC_HINTS)) {
      score -= 2;
    }
    if (includesAny(normalized, GLOOMY_TOPIC_HINTS)) {
      score -= 1;
    }
    if (includesAny(normalized, SUNNY_TOPIC_HINTS)) {
      score += 1;
    }
  }
  return score;
}

function includesAny(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}
