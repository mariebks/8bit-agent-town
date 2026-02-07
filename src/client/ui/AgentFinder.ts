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

  return score;
}
