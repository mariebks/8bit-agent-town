import { AgentData } from '@shared/Types';

export interface AgentSearchHit {
  id: string;
  name: string;
  occupation: string | null;
  score: number;
}

export function searchAgents(query: string, agents: AgentData[], maxResults = 6): AgentSearchHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }

  return agents
    .map((agent) => {
      const name = agent.name.toLowerCase();
      const occupation = agent.occupation?.toLowerCase() ?? '';
      const score = scoreAgentMatch(normalizedQuery, name, occupation);
      return {
        id: agent.id,
        name: agent.name,
        occupation: agent.occupation ?? null,
        score,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, maxResults);
}

function scoreAgentMatch(query: string, name: string, occupation: string): number {
  const tokens = tokenize(`${name} ${occupation}`);
  const initials = tokenize(name)
    .map((token) => token[0] ?? '')
    .join('');
  let score = 0;
  if (name === query) {
    score += 140;
  } else if (name.startsWith(query)) {
    score += 110;
  } else if (name.includes(query)) {
    score += 80;
  }

  if (occupation === query) {
    score += 70;
  } else if (occupation.startsWith(query)) {
    score += 50;
  } else if (occupation.includes(query)) {
    score += 35;
  }

  if (initials.startsWith(query) && query.length >= 2) {
    score += 60;
  }

  const fuzzyBonus = fuzzyTokenBonus(query, tokens);
  score += fuzzyBonus;

  return score;
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function fuzzyTokenBonus(query: string, tokens: string[]): number {
  if (query.length < 3 || tokens.length === 0) {
    return 0;
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (const token of tokens) {
    const distance = boundedLevenshtein(query, token, 2);
    if (distance < minDistance) {
      minDistance = distance;
    }
    if (minDistance === 0) {
      break;
    }
  }

  if (minDistance === 1) {
    return 28;
  }

  if (minDistance === 2 && query.length >= 5) {
    return 16;
  }

  return 0;
}

function boundedLevenshtein(left: string, right: string, maxDistance: number): number {
  const lengthDiff = Math.abs(left.length - right.length);
  if (lengthDiff > maxDistance) {
    return maxDistance + 1;
  }

  const previous = new Array<number>(right.length + 1);
  const current = new Array<number>(right.length + 1);
  for (let j = 0; j <= right.length; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}
