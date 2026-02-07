import { ConversationTurnEvent } from '@shared/Events';
import { AgentData } from '@shared/Types';

export interface ConversationQualityMetrics {
  totalTurns: number;
  conversationCount: number;
  topicSpreadCount: number;
  topicSpreadRate: number;
  topicalityScore: number;
  repetitionRate: number;
  memoryReferenceRate: number;
  relationshipConsistencyScore: number;
  uniqueTurnRatio: number;
}

export interface ConversationQualityReport {
  metrics: ConversationQualityMetrics;
  generatedAt: string;
  config: {
    ticks: number;
    days: number;
    seed: number;
    agentCount: number;
    llmEnabled: boolean;
  };
}

export function scoreConversationQuality(
  turnEvents: ConversationTurnEvent[],
  agents: AgentData[],
  topicSpreadCount = 0,
): ConversationQualityMetrics {
  const totalTurns = turnEvents.length;
  if (totalTurns === 0) {
    return {
      totalTurns: 0,
      conversationCount: 0,
      topicSpreadCount,
      topicSpreadRate: 0,
      topicalityScore: 0,
      repetitionRate: 0,
      memoryReferenceRate: 0,
      relationshipConsistencyScore: 0,
      uniqueTurnRatio: 0,
    };
  }

  const turnsByConversation = new Map<string, ConversationTurnEvent[]>();
  const normalizedTurnCounts = new Map<string, number>();
  let duplicateTurns = 0;
  let memoryReferenceTurns = 0;
  let consistencyChecks = 0;
  let consistencyPasses = 0;
  const averageRelationshipByAgent = new Map(agents.map((agent) => [agent.id, agent.relationshipSummary?.averageWeight ?? 0]));

  for (const turnEvent of turnEvents) {
    const list = turnsByConversation.get(turnEvent.conversationId) ?? [];
    list.push(turnEvent);
    turnsByConversation.set(turnEvent.conversationId, list);

    const normalized = normalizeLine(turnEvent.message);
    const seenCount = normalizedTurnCounts.get(normalized) ?? 0;
    duplicateTurns += seenCount > 0 ? 1 : 0;
    normalizedTurnCounts.set(normalized, seenCount + 1);

    if (MEMORY_REFERENCE_PATTERN.test(turnEvent.message)) {
      memoryReferenceTurns += 1;
    }

    const relationshipScore = averageRelationshipByAgent.get(turnEvent.speakerId) ?? 0;
    const positiveCue = POSITIVE_TONE_PATTERN.test(turnEvent.message);
    const tenseCue = TENSE_TONE_PATTERN.test(turnEvent.message);
    if (!positiveCue && !tenseCue) {
      continue;
    }

    consistencyChecks += 1;
    if (positiveCue && relationshipScore >= -5) {
      consistencyPasses += 1;
      continue;
    }
    if (tenseCue && relationshipScore <= 5) {
      consistencyPasses += 1;
    }
  }

  const topicalityScore = computeTopicalityScore(turnsByConversation);

  return {
    totalTurns,
    conversationCount: turnsByConversation.size,
    topicSpreadCount,
    topicSpreadRate: round4(topicSpreadCount / totalTurns),
    topicalityScore,
    repetitionRate: round4(duplicateTurns / totalTurns),
    memoryReferenceRate: round4(memoryReferenceTurns / totalTurns),
    relationshipConsistencyScore: round4(consistencyChecks === 0 ? 1 : consistencyPasses / consistencyChecks),
    uniqueTurnRatio: round4(normalizedTurnCounts.size / totalTurns),
  };
}

function computeTopicalityScore(turnsByConversation: Map<string, ConversationTurnEvent[]>): number {
  let weightedScore = 0;
  let weightedTurns = 0;

  for (const turns of turnsByConversation.values()) {
    if (turns.length === 0) {
      continue;
    }

    const conversationText = turns.map((turn) => turn.message).join(' ');
    const dominantTopic = findDominantTopicToken(conversationText);
    if (!dominantTopic) {
      continue;
    }

    const matchingTurns = turns.filter((turn) => normalizeLine(turn.message).includes(dominantTopic)).length;
    weightedScore += matchingTurns;
    weightedTurns += turns.length;
  }

  if (weightedTurns === 0) {
    return 0;
  }
  return round4(weightedScore / weightedTurns);
}

function findDominantTopicToken(text: string): string | null {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let bestToken: string | null = null;
  let bestCount = 0;
  for (const [token, count] of counts.entries()) {
    if (count <= bestCount) {
      continue;
    }
    bestToken = token;
    bestCount = count;
  }

  return bestToken;
}

function tokenize(text: string): string[] {
  return normalizeLine(text)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !STOPWORDS.has(token));
}

function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

const MEMORY_REFERENCE_PATTERN = /\b(remember|earlier|noticed|reflect|said|told|because|again)\b/i;
const POSITIVE_TONE_PATTERN = /\b(glad|good to see|sync|together|thanks|happy)\b/i;
const TENSE_TONE_PATTERN = /\b(listen|honestly|problem|worry|frustrat|angry)\b/i;
const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'around',
  'because',
  'could',
  'have',
  'just',
  'later',
  'maybe',
  'this',
  'that',
  'there',
  'they',
  'want',
  'with',
]);
