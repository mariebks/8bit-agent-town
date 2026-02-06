import { AgentFullState } from '../agents/AgentState';

export interface PromptContext {
  nearbyAgents: string[];
  nearbyLocations: string[];
  memorySnippets: string[];
  gameTimeText: string;
}

const HARD_PROMPT_CHAR_CAP = 2200;

function trimToLimit(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

export function buildActionPrompt(agent: AgentFullState, context: PromptContext): string {
  const profile = [
    `name=${agent.name}`,
    `occupation=${agent.occupation.id}`,
    `traits=${agent.traits.join(',')}`,
    `interests=${agent.interests.join(',')}`,
    `energy=${agent.status.energy.toFixed(0)}`,
    `hunger=${agent.status.hunger.toFixed(0)}`,
    `mood=${agent.status.mood.toFixed(0)}`,
  ].join('\n');

  const environment = [
    `gameTime=${context.gameTimeText}`,
    `nearbyLocations=${context.nearbyLocations.join(', ') || 'none'}`,
    `nearbyAgents=${context.nearbyAgents.join(', ') || 'none'}`,
  ].join('\n');

  const memories = context.memorySnippets.length > 0 ? context.memorySnippets.join('\n- ') : 'none';

  const prompt = [
    'Return STRICT JSON only: {"action":"...","target":"...","reason":"...","urgency":5}',
    'Allowed action values: MOVE_TO, START_ACTIVITY, TALK_TO, WAIT, GO_HOME, EAT, SLEEP, WORK',
    'Keep reason short and concrete. Never include markdown.',
    '',
    '[Agent]',
    profile,
    '',
    '[Context]',
    environment,
    '',
    '[Relevant memories]',
    `- ${memories}`,
  ].join('\n');

  return trimToLimit(prompt, HARD_PROMPT_CHAR_CAP);
}

export function buildImportancePrompt(observation: string): string {
  const body = [
    'Score the observation importance from 1 to 10.',
    'Return STRICT JSON: {"importance": number, "reason": "short"}',
    `Observation: ${observation}`,
  ].join('\n');

  return trimToLimit(body, 600);
}
