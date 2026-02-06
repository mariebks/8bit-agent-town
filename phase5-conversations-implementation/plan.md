# Phase 5: Conversations and Relationships Implementation Plan

## Objectives

Enable agents to engage in turn-based conversations, update relationship weights based on interactions, and propagate information socially through the town simulation.

## Expert corrections (supersedes conflicting details below)

1. Determinism rules still apply:
   - Use seeded RNG and simulation time for conversation timing/triggering.
   - Do not use `Date.now()` or `Math.random()` for conversation outcomes.
2. Conversation turns must be queue-aware:
   - If LLM queue latency is high, use fallback dialogue immediately.
   - Avoid waiting full timeout windows when backpressure is already known.
3. Social propagation must include confidence decay:
   - Each propagated fact should carry confidence and hop count/TTL.
   - Prevent infinite rumor amplification loops.
4. Relationship updates should be bounded and stable:
   - Apply capped deltas per conversation and optional decay over time.
   - Keep directional updates explicit (A->B may differ from B->A).
5. UI speech constraints:
   - Clamp bubble text length and duration to avoid visual flooding.
   - Always send full text to log panel even when bubble text is truncated.

### Primary Goals
1. Two agents can lock into a multi-turn dialogue without blocking other simulation systems
2. Conversations affect relationship weights measurably
3. Information shared in conversations propagates as memories
4. Visual feedback via speech bubbles and log panel entries

## Prerequisites

This phase depends on completed work from prior phases:
- Phase 1: World rendering with agent sprites
- Phase 2: Simulation loop, tick scheduler, WebSocket transport
- Phase 3: LLM integration with OllamaClient, prompt templates, JSON schemas
- Phase 4: Memory stream with observations, reflections, retrieval scoring

## Approach

### Architecture Overview

```
ConversationManager (server)
├── Active conversations map
├── Turn state machine
├── Proximity detection
└── Event emission

Relationships (server)
├── Weighted edge graph
├── Update rules
└── Inspector serialization

Client UI
├── Speech bubble renderer
└── Log panel dialogue entries
```

### Key Design Decisions

1. **Non-blocking conversations**: Agents in dialogue remain in `Conversing` state but do not block the tick loop. Other agents continue normal behavior.
2. **Turn timeout**: Each turn has a max wait window in simulation time (for example, 10 game minutes). If LLM fails or queue backpressure is high, rule-based fallback generates a short reply immediately.
3. **Conversation capacity**: Only one active conversation per agent at a time. Multiple conversations can occur simultaneously between different agent pairs.
4. **End conditions**: Conversations end when max turns reached, an agent signals END, or an agent's path priority overrides (emergency/high-priority action).

## Step-by-Step Implementation

---

### Task 1: Conversation State Types and Events

**Location**: `src/shared/Types.ts`, `src/shared/Events.ts`

**Instructions**:

1. Add conversation-related types to `src/shared/Types.ts`:

```typescript
export type ConversationId = string;

export interface ConversationTurn {
  speakerId: AgentId;
  message: string;
  timestamp: number; // game time total minutes
}

export interface ConversationData {
  id: ConversationId;
  participants: [AgentId, AgentId];
  turns: ConversationTurn[];
  startTime: number;
  endTime?: number;
  location: LocationId;
}

export interface RelationshipEdge {
  targetId: AgentId;
  weight: number; // -100 to 100
  tags: string[]; // e.g., 'friend', 'coworker', 'rival', 'acquaintance'
  lastInteraction: number; // game time total minutes
}

export interface RelationshipGraph {
  [agentId: AgentId]: RelationshipEdge[];
}
```

2. Add WebSocket event schemas to `src/shared/Events.ts`:

```typescript
export const ConversationStartEventSchema = z.object({
  type: z.literal('conversationStart'),
  conversationId: z.string(),
  participants: z.tuple([z.string(), z.string()]),
  location: z.string(),
  gameTime: GameTimeSchema
});

export const ConversationTurnEventSchema = z.object({
  type: z.literal('conversationTurn'),
  conversationId: z.string(),
  speakerId: z.string(),
  message: z.string(),
  gameTime: GameTimeSchema
});

export const ConversationEndEventSchema = z.object({
  type: z.literal('conversationEnd'),
  conversationId: z.string(),
  reason: z.enum(['maxTurns', 'agentEnded', 'timeout', 'interrupted']),
  gameTime: GameTimeSchema
});

export const SpeechBubbleEventSchema = z.object({
  type: z.literal('speechBubble'),
  agentId: z.string(),
  message: z.string(),
  duration: z.number() // ticks to display
});
```

**End State**: Shared types compile and are importable by both client and server.

---

### Task 2: Conversation Manager Core

**Location**: `src/server/agents/behaviors/Conversation.ts`

**Instructions**:

1. Create the ConversationManager class:

```typescript
import { v4 as uuid } from 'uuid';
import { AgentId, ConversationId, ConversationData, ConversationTurn, GameTime } from '../../../shared/Types';

interface ActiveConversation {
  data: ConversationData;
  currentTurnAgentId: AgentId;
  turnDeadlineGameMinute: number; // simulation-time deadline for timeout
  turnNumber: number;
  pendingEnd: boolean;
}

export interface ConversationConfig {
  maxTurns: number; // default 8
  turnTimeoutMinutes: number; // default 10 game minutes
  proximityTiles: number; // default 2
  minRelationshipWeight: number; // default -50 (won't talk to enemies)
  cooldownMinutes: number; // game minutes before same pair can talk again
}

export class ConversationManager {
  private activeConversations: Map<ConversationId, ActiveConversation> = new Map();
  private agentToConversation: Map<AgentId, ConversationId> = new Map();
  private recentPairs: Map<string, number> = new Map(); // "id1:id2" -> lastEndTime
  private config: ConversationConfig;

  constructor(config: Partial<ConversationConfig> = {}) {
    this.config = {
      maxTurns: 8,
      turnTimeoutMinutes: 10,
      proximityTiles: 2,
      minRelationshipWeight: -50,
      cooldownMinutes: 30,
      ...config
    };
  }
}
```

2. Implement core methods:

```typescript
// Check if agent is available for conversation
isAgentAvailable(agentId: AgentId): boolean {
  return !this.agentToConversation.has(agentId);
}

// Get conversation an agent is in
getAgentConversation(agentId: AgentId): ActiveConversation | null {
  const convId = this.agentToConversation.get(agentId);
  return convId ? this.activeConversations.get(convId) ?? null : null;
}

// Check cooldown between agent pair
private getPairKey(a: AgentId, b: AgentId): string {
  return [a, b].sort().join(':');
}

canStartConversation(agentA: AgentId, agentB: AgentId, currentGameTime: number): boolean {
  if (!this.isAgentAvailable(agentA) || !this.isAgentAvailable(agentB)) {
    return false;
  }
  const pairKey = this.getPairKey(agentA, agentB);
  const lastEnd = this.recentPairs.get(pairKey);
  if (lastEnd && currentGameTime - lastEnd < this.config.cooldownMinutes) {
    return false;
  }
  return true;
}

// Start a new conversation
startConversation(
  agentA: AgentId,
  agentB: AgentId,
  locationId: string,
  gameTime: GameTime
): ConversationData | null {
  if (!this.canStartConversation(agentA, agentB, gameTime.totalMinutes)) {
    return null;
  }

  const id = uuid();
  const data: ConversationData = {
    id,
    participants: [agentA, agentB],
    turns: [],
    startTime: gameTime.totalMinutes,
    location: locationId
  };

  const active: ActiveConversation = {
    data,
    currentTurnAgentId: agentA, // First speaker
    turnDeadlineGameMinute: gameTime.totalMinutes + this.config.turnTimeoutMinutes,
    turnNumber: 0,
    pendingEnd: false
  };

  this.activeConversations.set(id, active);
  this.agentToConversation.set(agentA, id);
  this.agentToConversation.set(agentB, id);

  return data;
}
```

3. Implement turn processing:

```typescript
// Add a turn and advance to next speaker
addTurn(
  conversationId: ConversationId,
  speakerId: AgentId,
  message: string,
  gameTime: GameTime,
  signalEnd: boolean = false
): { success: boolean; conversationEnded: boolean; endReason?: string } {
  const active = this.activeConversations.get(conversationId);
  if (!active) {
    return { success: false, conversationEnded: false };
  }

  if (active.currentTurnAgentId !== speakerId) {
    return { success: false, conversationEnded: false };
  }

  const turn: ConversationTurn = {
    speakerId,
    message,
    timestamp: gameTime.totalMinutes
  };
  active.data.turns.push(turn);
  active.turnNumber++;

  // Check end conditions
  if (signalEnd || active.turnNumber >= this.config.maxTurns) {
    const reason = signalEnd ? 'agentEnded' : 'maxTurns';
    this.endConversation(conversationId, reason, gameTime);
    return { success: true, conversationEnded: true, endReason: reason };
  }

  // Advance to next speaker
  const [a, b] = active.data.participants;
  active.currentTurnAgentId = speakerId === a ? b : a;
  active.turnDeadlineGameMinute = gameTime.totalMinutes + this.config.turnTimeoutMinutes;

  return { success: true, conversationEnded: false };
}

// End conversation and cleanup
endConversation(
  conversationId: ConversationId,
  reason: string,
  gameTime: GameTime
): ConversationData | null {
  const active = this.activeConversations.get(conversationId);
  if (!active) return null;

  active.data.endTime = gameTime.totalMinutes;

  // Cleanup maps
  const [a, b] = active.data.participants;
  this.agentToConversation.delete(a);
  this.agentToConversation.delete(b);
  this.activeConversations.delete(conversationId);

  // Record cooldown
  const pairKey = this.getPairKey(a, b);
  this.recentPairs.set(pairKey, gameTime.totalMinutes);

  return active.data;
}

// Check for timed out turns (call each tick)
checkTimeouts(gameTime: GameTime): Array<{ conversationId: ConversationId; agentId: AgentId }> {
  const timedOut: Array<{ conversationId: ConversationId; agentId: AgentId }> = [];

  for (const [id, active] of this.activeConversations) {
    if (gameTime.totalMinutes >= active.turnDeadlineGameMinute) {
      timedOut.push({ conversationId: id, agentId: active.currentTurnAgentId });
    }
  }

  return timedOut;
}
```

**End State**: ConversationManager can track multiple simultaneous conversations, enforce turn order, detect timeouts, and handle conversation lifecycle.

---

### Task 3: Dialogue Prompts and LLM Integration

**Location**: `src/server/llm/PromptTemplates.ts`, `src/server/llm/ResponseSchemas.ts`

**Instructions**:

1. Add dialogue prompt template to `PromptTemplates.ts`:

```typescript
export interface DialoguePromptContext {
  agentName: string;
  agentProfile: string; // traits, occupation, bio
  partnerName: string;
  partnerProfile: string;
  relationshipDescription: string; // e.g., "friendly coworker"
  location: string;
  conversationHistory: Array<{ speaker: string; message: string }>;
  recentMemories: string[]; // relevant retrieved memories
  currentTime: string; // formatted game time
}

export function buildDialoguePrompt(ctx: DialoguePromptContext): string {
  const history = ctx.conversationHistory
    .map(t => `${t.speaker}: "${t.message}"`)
    .join('\n');

  const memories = ctx.recentMemories.length > 0
    ? `Recent relevant memories:\n${ctx.recentMemories.map(m => `- ${m}`).join('\n')}`
    : '';

  return `You are ${ctx.agentName}, a character in a small town.
${ctx.agentProfile}

You are having a conversation with ${ctx.partnerName} at ${ctx.location}.
${ctx.partnerProfile}
Your relationship: ${ctx.relationshipDescription}

Current time: ${ctx.currentTime}

${memories}

Conversation so far:
${history || '(This is the start of the conversation)'}

Respond as ${ctx.agentName}. Keep your response brief (1-3 sentences). 
If you want to end the conversation naturally, set "endConversation" to true.

Respond in JSON format only:
{
  "message": "your dialogue response",
  "endConversation": false,
  "sentiment": "positive" | "neutral" | "negative"
}`;
}
```

2. Add response schema to `ResponseSchemas.ts`:

```typescript
export const DialogueResponseSchema = z.object({
  message: z.string().max(500),
  endConversation: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative'])
});

export type DialogueResponse = z.infer<typeof DialogueResponseSchema>;
```

3. Add rule-based fallback dialogue generator:

```typescript
// src/server/agents/behaviors/DialogueFallback.ts

const FALLBACK_RESPONSES = {
  greeting: [
    "Hello there!",
    "Hey, how's it going?",
    "Nice to see you!",
    "Hi! What's new?"
  ],
  neutral: [
    "I see what you mean.",
    "That's interesting.",
    "Hmm, I hadn't thought of that.",
    "Makes sense to me."
  ],
  positive: [
    "That's great to hear!",
    "I'm glad things are going well.",
    "Sounds wonderful!",
    "How nice!"
  ],
  negative: [
    "I'm sorry to hear that.",
    "That sounds difficult.",
    "I hope things improve.",
    "That's too bad."
  ],
  ending: [
    "Well, I should get going.",
    "It was nice talking to you!",
    "I'll see you around.",
    "Take care!"
  ]
};

export function generateFallbackDialogue(
  turnNumber: number,
  maxTurns: number,
  rng: SeededRNG,
  lastSentiment?: string
): { message: string; endConversation: boolean; sentiment: 'neutral' } {
  // First turn is always a greeting
  if (turnNumber === 0) {
    const greetings = FALLBACK_RESPONSES.greeting;
    return {
      message: rng.pick(greetings),
      endConversation: false,
      sentiment: 'neutral'
    };
  }

  // Near max turns, end the conversation
  if (turnNumber >= maxTurns - 2) {
    const endings = FALLBACK_RESPONSES.ending;
    return {
      message: rng.pick(endings),
      endConversation: true,
      sentiment: 'neutral'
    };
  }

  // Otherwise, respond based on partner's sentiment
  let pool = FALLBACK_RESPONSES.neutral;
  if (lastSentiment === 'positive') {
    pool = FALLBACK_RESPONSES.positive;
  } else if (lastSentiment === 'negative') {
    pool = FALLBACK_RESPONSES.negative;
  }

  return {
    message: rng.pick(pool),
    endConversation: false,
    sentiment: 'neutral'
  };
}
```

**End State**: Dialogue prompts produce valid JSON responses from the LLM. Rule-based fallback generates sensible short replies when LLM fails.

---

### Task 4: Relationship System

**Location**: `src/server/agents/behaviors/Relationships.ts`

**Instructions**:

1. Create the RelationshipManager class:

```typescript
import { AgentId, RelationshipEdge, RelationshipGraph } from '../../../shared/Types';

export interface RelationshipUpdateResult {
  previousWeight: number;
  newWeight: number;
  delta: number;
}

export class RelationshipManager {
  private graph: RelationshipGraph = {};

  // Initialize an agent's relationship list
  initializeAgent(agentId: AgentId, initialRelationships: RelationshipEdge[] = []): void {
    this.graph[agentId] = initialRelationships;
  }

  // Get relationship between two agents
  getRelationship(agentId: AgentId, targetId: AgentId): RelationshipEdge | null {
    const edges = this.graph[agentId];
    if (!edges) return null;
    return edges.find(e => e.targetId === targetId) ?? null;
  }

  // Get all relationships for an agent
  getRelationships(agentId: AgentId): RelationshipEdge[] {
    return this.graph[agentId] ?? [];
  }

  // Get top N strongest relationships
  getTopRelationships(agentId: AgentId, n: number = 5): RelationshipEdge[] {
    const edges = this.graph[agentId] ?? [];
    return [...edges]
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, n);
  }

  // Describe relationship in human terms
  describeRelationship(edge: RelationshipEdge | null): string {
    if (!edge) return 'stranger';
    if (edge.weight >= 80) return 'close friend';
    if (edge.weight >= 50) return 'good friend';
    if (edge.weight >= 20) return 'friendly acquaintance';
    if (edge.weight >= -20) return 'neutral acquaintance';
    if (edge.weight >= -50) return 'unfriendly';
    return 'rival';
  }
}
```

2. Implement relationship updates:

```typescript
// Ensure bidirectional edge exists
private ensureEdge(agentA: AgentId, agentB: AgentId, gameTime: number): void {
  if (!this.graph[agentA]) this.graph[agentA] = [];
  if (!this.graph[agentB]) this.graph[agentB] = [];

  if (!this.graph[agentA].find(e => e.targetId === agentB)) {
    this.graph[agentA].push({
      targetId: agentB,
      weight: 0,
      tags: ['acquaintance'],
      lastInteraction: gameTime
    });
  }

  if (!this.graph[agentB].find(e => e.targetId === agentA)) {
    this.graph[agentB].push({
      targetId: agentA,
      weight: 0,
      tags: ['acquaintance'],
      lastInteraction: gameTime
    });
  }
}

// Update relationship based on conversation outcome
updateFromConversation(
  agentA: AgentId,
  agentB: AgentId,
  sentiments: Array<{ agentId: AgentId; sentiment: 'positive' | 'neutral' | 'negative' }>,
  gameTime: number
): { resultA: RelationshipUpdateResult; resultB: RelationshipUpdateResult } {
  this.ensureEdge(agentA, agentB, gameTime);

  const edgeA = this.graph[agentA].find(e => e.targetId === agentB)!;
  const edgeB = this.graph[agentB].find(e => e.targetId === agentA)!;

  const prevA = edgeA.weight;
  const prevB = edgeB.weight;

  // Calculate sentiment deltas
  const sentimentValues = { positive: 5, neutral: 1, negative: -5 };

  // A's sentiment towards B affects B's perception of A
  const aSentiments = sentiments.filter(s => s.agentId === agentA);
  const bSentiments = sentiments.filter(s => s.agentId === agentB);

  let deltaA = 0;
  let deltaB = 0;

  for (const s of bSentiments) {
    deltaA += sentimentValues[s.sentiment];
  }
  for (const s of aSentiments) {
    deltaB += sentimentValues[s.sentiment];
  }

  // Apply with diminishing returns at extremes
  edgeA.weight = this.clampWeight(edgeA.weight + deltaA);
  edgeB.weight = this.clampWeight(edgeB.weight + deltaB);

  edgeA.lastInteraction = gameTime;
  edgeB.lastInteraction = gameTime;

  // Update tags based on weight thresholds
  this.updateTags(edgeA);
  this.updateTags(edgeB);

  return {
    resultA: { previousWeight: prevA, newWeight: edgeA.weight, delta: deltaA },
    resultB: { previousWeight: prevB, newWeight: edgeB.weight, delta: deltaB }
  };
}

private clampWeight(weight: number): number {
  return Math.max(-100, Math.min(100, weight));
}

private updateTags(edge: RelationshipEdge): void {
  const tags = new Set<string>();

  if (edge.weight >= 50) tags.add('friend');
  else if (edge.weight >= 0) tags.add('acquaintance');
  else if (edge.weight >= -50) tags.add('unfriendly');
  else tags.add('rival');

  edge.tags = Array.from(tags);
}

// Serialize for inspector
serializeForInspector(agentId: AgentId): Array<{ name: string; weight: number; tags: string[] }> {
  // Note: This will need agent name lookup, handled at integration layer
  return this.getRelationships(agentId).map(e => ({
    name: e.targetId, // Replace with actual name at call site
    weight: e.weight,
    tags: e.tags
  }));
}
```

**End State**: Relationships update measurably after conversations. Weight changes visible via inspector serialization.

---

### Task 5: Social Propagation

**Location**: `src/server/agents/behaviors/Conversation.ts` (extension), `src/server/memory/MemoryStream.ts` (integration)

**Instructions**:

1. Add fact extraction and propagation to ConversationManager:

```typescript
export interface PropagatedFact {
  content: string;
  sourceAgentId: AgentId;
  originalSourceAgentId?: AgentId; // If this was heard from someone else
  timestamp: number;
  confidence: number; // 0-1
  hopCount: number;
  maxHopCount: number;
}

// In ConversationManager class:

// Extract facts from a conversation turn that can be propagated
extractFacts(message: string, speakerId: AgentId, gameTime: number): PropagatedFact[] {
  // Simple heuristic: statements that seem like news or information
  const facts: PropagatedFact[] = [];
  
  // Pattern matching for factual statements
  const factPatterns = [
    /I heard that (.+)/i,
    /Did you know (.+)/i,
    /(.+) told me that (.+)/i,
    /I saw (.+) at (.+)/i,
    /(.+) is (.+ing) at (.+)/i
  ];

  for (const pattern of factPatterns) {
    const match = message.match(pattern);
    if (match) {
      facts.push({
        content: match[0],
        sourceAgentId: speakerId,
        timestamp: gameTime,
        confidence: 0.7,
        hopCount: 0,
        maxHopCount: 3
      });
    }
  }

  return facts;
}

// Create propagation memory for receiving agent
createPropagationMemory(
  fact: PropagatedFact,
  receiverId: AgentId,
  gameTime: number
): ObservationMemory {
  return {
    type: 'observation',
    content: `${fact.sourceAgentId} told me (${Math.round(fact.confidence * 100)}% confidence): "${fact.content}"`,
    timestamp: gameTime,
    location: 'conversation',
    subjects: [fact.sourceAgentId],
    importance: fact.confidence >= 0.7 ? 5 : 3,
    source: 'dialogue'
  };
}
```

2. Integrate with MemoryStream during conversation processing:

```typescript
// In conversation turn processing flow:
async processTurn(
  conversationId: ConversationId,
  response: DialogueResponse,
  speakerId: AgentId,
  receiverId: AgentId,
  receiverMemoryStream: MemoryStream,
  gameTime: GameTime
): Promise<void> {
  // Add turn to conversation
  this.addTurn(conversationId, speakerId, response.message, gameTime, response.endConversation);

  // Extract facts and propagate to receiver
  const facts = this.extractFacts(response.message, speakerId, gameTime.totalMinutes);
  for (const fact of facts) {
    if (fact.hopCount >= fact.maxHopCount || fact.confidence < 0.35) continue;
    const forwardedFact = {
      ...fact,
      hopCount: fact.hopCount + 1,
      confidence: Math.max(0, fact.confidence - 0.15)
    };
    const memory = this.createPropagationMemory(forwardedFact, receiverId, gameTime.totalMinutes);
    receiverMemoryStream.addObservation(memory);
  }
}
```

**End State**: When agent A tells agent B information, B stores it as an observation memory that can influence B's future behavior and be passed on to others.

---

### Task 6: Conversation Trigger Logic

**Location**: `src/server/simulation/Simulation.ts` (integration point)

**Instructions**:

1. Add conversation trigger checking to the tick loop:

```typescript
interface ConversationTriggerContext {
  proximityTiles: number;
  minRelationshipWeight: number;
  scheduleOverlapCheck: boolean;
}

// Check if two agents should start a conversation
shouldStartConversation(
  agentA: Agent,
  agentB: Agent,
  relationships: RelationshipManager,
  conversationManager: ConversationManager,
  gameTime: GameTime,
  rng: SeededRNG,
  config: ConversationTriggerContext
): boolean {
  // Both must be available
  if (!conversationManager.isAgentAvailable(agentA.id) ||
      !conversationManager.isAgentAvailable(agentB.id)) {
    return false;
  }

  // Both must be Idle (not walking, sleeping, etc.)
  if (agentA.state !== AgentState.Idle || agentB.state !== AgentState.Idle) {
    return false;
  }

  // Proximity check
  const distance = Math.abs(agentA.tilePosition.tileX - agentB.tilePosition.tileX) +
                   Math.abs(agentA.tilePosition.tileY - agentB.tilePosition.tileY);
  if (distance > config.proximityTiles) {
    return false;
  }

  // Relationship check
  const relationship = relationships.getRelationship(agentA.id, agentB.id);
  const weight = relationship?.weight ?? 0;
  if (weight < config.minRelationshipWeight) {
    return false;
  }

  // Cooldown check
  if (!conversationManager.canStartConversation(agentA.id, agentB.id, gameTime.totalMinutes)) {
    return false;
  }

  // Random chance based on relationship (higher weight = more likely)
  const baseChance = 0.05; // 5% base chance per tick when conditions met
  const weightBonus = Math.max(0, weight) / 200; // Up to +50% for max positive relationship
  const totalChance = baseChance + weightBonus;

  return rng.next() < totalChance;
}
```

2. Add conversation tick processing to simulation loop:

```typescript
// Each tick in simulation:
processConversations(gameTime: GameTime): void {
  // Check for new conversations
  const availableAgents = this.agents.filter(a =>
    a.state === AgentState.Idle &&
    this.conversationManager.isAgentAvailable(a.id)
  );

  // Check pairs
  for (let i = 0; i < availableAgents.length; i++) {
    for (let j = i + 1; j < availableAgents.length; j++) {
      if (this.shouldStartConversation(
        availableAgents[i],
        availableAgents[j],
        this.relationships,
        this.conversationManager,
        gameTime,
        this.rng,
        this.config.conversation
      )) {
        this.startConversation(availableAgents[i], availableAgents[j], gameTime);
        break; // One new conversation per tick max
      }
    }
  }

  // Process active conversation turns
  for (const agent of this.agents) {
    const conv = this.conversationManager.getAgentConversation(agent.id);
    if (conv && conv.currentTurnAgentId === agent.id) {
      this.processAgentConversationTurn(agent, conv, gameTime);
    }
  }

  // Check timeouts
  const timeouts = this.conversationManager.checkTimeouts(gameTime);
  for (const { conversationId, agentId } of timeouts) {
    this.handleConversationTimeout(conversationId, agentId, gameTime);
  }
}
```

**End State**: Conversations trigger naturally based on proximity, relationship, and agent availability.

---

### Task 7: Client Speech Bubbles

**Location**: `src/client/game/sprites/SpeechBubble.ts`

**Instructions**:

1. Create SpeechBubble class:

```typescript
import Phaser from 'phaser';
import { TILE_SIZE } from '../../../shared/Constants';

export interface SpeechBubbleConfig {
  maxWidth: number;
  padding: number;
  fontSize: number;
  backgroundColor: number;
  textColor: string;
  borderColor: number;
  displayDurationMs: number;
}

const DEFAULT_CONFIG: SpeechBubbleConfig = {
  maxWidth: 150,
  padding: 8,
  fontSize: 10,
  backgroundColor: 0xffffff,
  textColor: '#000000',
  borderColor: 0x000000,
  displayDurationMs: 3000
};

export class SpeechBubble extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private config: SpeechBubbleConfig;
  private displayTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
    config: Partial<SpeechBubbleConfig> = {}
  ) {
    super(scene, x, y);
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.background = scene.add.graphics();
    this.text = scene.add.text(0, 0, message, {
      fontSize: `${this.config.fontSize}px`,
      color: this.config.textColor,
      wordWrap: { width: this.config.maxWidth - this.config.padding * 2 },
      fontFamily: 'monospace'
    });

    this.add(this.background);
    this.add(this.text);

    this.drawBubble();
    scene.add.existing(this);
  }

  private drawBubble(): void {
    const textBounds = this.text.getBounds();
    const width = textBounds.width + this.config.padding * 2;
    const height = textBounds.height + this.config.padding * 2;
    const tailHeight = 8;

    this.background.clear();

    // Border
    this.background.lineStyle(2, this.config.borderColor, 1);
    this.background.fillStyle(this.config.backgroundColor, 1);

    // Main bubble
    this.background.fillRoundedRect(-width / 2, -height - tailHeight, width, height, 4);
    this.background.strokeRoundedRect(-width / 2, -height - tailHeight, width, height, 4);

    // Tail (small triangle pointing down)
    this.background.fillTriangle(
      -4, -tailHeight,
      4, -tailHeight,
      0, 0
    );
    this.background.strokeTriangle(
      -4, -tailHeight,
      4, -tailHeight,
      0, 0
    );

    // Position text
    this.text.setPosition(-width / 2 + this.config.padding, -height - tailHeight + this.config.padding);
  }

  show(durationMs?: number): void {
    this.setVisible(true);
    this.setAlpha(1);

    if (this.displayTimer) {
      this.displayTimer.destroy();
    }

    const duration = durationMs ?? this.config.displayDurationMs;
    this.displayTimer = this.scene.time.delayedCall(duration, () => {
      this.hide();
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.setVisible(false);
      }
    });
  }

  updateMessage(message: string): void {
    this.text.setText(message);
    this.drawBubble();
  }

  destroy(): void {
    if (this.displayTimer) {
      this.displayTimer.destroy();
    }
    super.destroy();
  }
}
```

2. Create SpeechBubbleManager for the scene:

```typescript
// src/client/game/sprites/SpeechBubbleManager.ts

import Phaser from 'phaser';
import { AgentId } from '../../../shared/Types';
import { SpeechBubble } from './SpeechBubble';

export class SpeechBubbleManager {
  private scene: Phaser.Scene;
  private bubbles: Map<AgentId, SpeechBubble> = new Map();
  private agentPositions: Map<AgentId, { x: number; y: number }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showBubble(agentId: AgentId, message: string, durationMs: number = 3000): void {
    // Remove existing bubble if any
    this.hideBubble(agentId);

    const pos = this.agentPositions.get(agentId);
    if (!pos) return;

    const bubble = new SpeechBubble(
      this.scene,
      pos.x,
      pos.y - 16, // Offset above agent sprite
      message
    );

    this.bubbles.set(agentId, bubble);
    bubble.show(durationMs);

    // Auto-cleanup after duration
    this.scene.time.delayedCall(durationMs + 300, () => {
      this.hideBubble(agentId);
    });
  }

  hideBubble(agentId: AgentId): void {
    const bubble = this.bubbles.get(agentId);
    if (bubble) {
      bubble.destroy();
      this.bubbles.delete(agentId);
    }
  }

  updateAgentPosition(agentId: AgentId, x: number, y: number): void {
    this.agentPositions.set(agentId, { x, y });

    // Update bubble position if visible
    const bubble = this.bubbles.get(agentId);
    if (bubble) {
      bubble.setPosition(x, y - 16);
    }
  }

  clear(): void {
    for (const bubble of this.bubbles.values()) {
      bubble.destroy();
    }
    this.bubbles.clear();
  }
}
```

**End State**: Speech bubbles appear above agents during conversations, auto-hide after duration, and follow agent movement.

---

### Task 8: Log Panel Dialogue Integration

**Location**: `src/client/ui/LogPanel.ts` (modification), `src/shared/Events.ts` (add types)

**Instructions**:

1. Add dialogue log event type:

```typescript
// In Events.ts
export const LogEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('action'),
    agentId: z.string(),
    agentName: z.string(),
    action: z.string(),
    timestamp: GameTimeSchema
  }),
  z.object({
    type: z.literal('dialogue'),
    conversationId: z.string(),
    speakerId: z.string(),
    speakerName: z.string(),
    listenerId: z.string(),
    listenerName: z.string(),
    message: z.string(),
    timestamp: GameTimeSchema
  }),
  z.object({
    type: z.literal('conversationStart'),
    conversationId: z.string(),
    participants: z.array(z.object({ id: z.string(), name: z.string() })),
    location: z.string(),
    timestamp: GameTimeSchema
  }),
  z.object({
    type: z.literal('conversationEnd'),
    conversationId: z.string(),
    reason: z.string(),
    timestamp: GameTimeSchema
  })
]);

export type LogEvent = z.infer<typeof LogEventSchema>;
```

2. Update LogPanel to render dialogue entries:

```typescript
// In LogPanel.ts

interface LogPanelConfig {
  maxEntries: number;
  filterTypes: string[];
  filterAgentId?: string;
}

class LogPanel {
  private entries: LogEvent[] = [];
  private container: HTMLElement;
  private config: LogPanelConfig;

  constructor(containerId: string, config: Partial<LogPanelConfig> = {}) {
    this.container = document.getElementById(containerId)!;
    this.config = {
      maxEntries: 100,
      filterTypes: ['action', 'dialogue', 'conversationStart', 'conversationEnd'],
      ...config
    };
  }

  addEntry(event: LogEvent): void {
    this.entries.unshift(event);
    if (this.entries.length > this.config.maxEntries) {
      this.entries.pop();
    }
    this.render();
  }

  private render(): void {
    const filtered = this.entries.filter(e => {
      if (!this.config.filterTypes.includes(e.type)) return false;
      if (this.config.filterAgentId) {
        if (e.type === 'dialogue') {
          return e.speakerId === this.config.filterAgentId ||
                 e.listenerId === this.config.filterAgentId;
        }
        if (e.type === 'action') {
          return e.agentId === this.config.filterAgentId;
        }
      }
      return true;
    });

    this.container.innerHTML = filtered.map(e => this.renderEntry(e)).join('');
  }

  private renderEntry(event: LogEvent): string {
    const time = this.formatTime(event.timestamp);

    switch (event.type) {
      case 'dialogue':
        return `
          <div class="log-entry log-dialogue">
            <span class="log-time">[${time}]</span>
            <span class="log-speaker">${event.speakerName}:</span>
            <span class="log-message">"${event.message}"</span>
          </div>
        `;

      case 'conversationStart':
        const names = event.participants.map(p => p.name).join(' & ');
        return `
          <div class="log-entry log-system">
            <span class="log-time">[${time}]</span>
            <span class="log-info">💬 ${names} started talking at ${event.location}</span>
          </div>
        `;

      case 'conversationEnd':
        return `
          <div class="log-entry log-system">
            <span class="log-time">[${time}]</span>
            <span class="log-info">💬 Conversation ended (${event.reason})</span>
          </div>
        `;

      case 'action':
        return `
          <div class="log-entry log-action">
            <span class="log-time">[${time}]</span>
            <span class="log-agent">${event.agentName}</span>
            <span class="log-action-text">${event.action}</span>
          </div>
        `;

      default:
        return '';
    }
  }

  private formatTime(time: { day: number; hour: number; minute: number }): string {
    const h = time.hour.toString().padStart(2, '0');
    const m = time.minute.toString().padStart(2, '0');
    return `Day ${time.day} ${h}:${m}`;
  }

  setFilter(types?: string[], agentId?: string): void {
    if (types) this.config.filterTypes = types;
    this.config.filterAgentId = agentId;
    this.render();
  }
}
```

**End State**: Log panel displays dialogue with timestamps, speaker names, and conversation lifecycle events.

---

### Task 9: Inspector Panel Relationship Display

**Location**: `src/client/ui/InspectorPanel.ts` (modification)

**Instructions**:

1. Add relationship section to inspector:

```typescript
// In InspectorPanel.ts

interface RelationshipDisplay {
  name: string;
  weight: number;
  tags: string[];
}

class InspectorPanel {
  // ... existing fields ...
  private relationshipsContainer: HTMLElement;

  renderRelationships(relationships: RelationshipDisplay[]): void {
    const sorted = [...relationships].sort((a, b) => b.weight - a.weight);

    const html = sorted.map(rel => {
      const barWidth = Math.abs(rel.weight);
      const barColor = rel.weight >= 0 ? '#4ade80' : '#f87171';
      const barDirection = rel.weight >= 0 ? 'right' : 'left';

      return `
        <div class="relationship-row">
          <span class="rel-name">${rel.name}</span>
          <div class="rel-bar-container">
            <div class="rel-bar-center"></div>
            <div class="rel-bar"
                 style="width: ${barWidth}%;
                        background: ${barColor};
                        ${barDirection === 'left' ? 'right: 50%' : 'left: 50%'}">
            </div>
          </div>
          <span class="rel-weight">${rel.weight > 0 ? '+' : ''}${rel.weight}</span>
          <span class="rel-tags">${rel.tags.join(', ')}</span>
        </div>
      `;
    }).join('');

    this.relationshipsContainer.innerHTML = `
      <div class="inspector-section">
        <h3>Relationships</h3>
        ${html || '<p class="empty">No relationships yet</p>'}
      </div>
    `;
  }
}
```

2. Add CSS styles:

```css
/* In styles.css */

.relationship-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.rel-name {
  width: 80px;
  font-weight: bold;
}

.rel-bar-container {
  flex: 1;
  height: 8px;
  background: #333;
  position: relative;
  border-radius: 4px;
}

.rel-bar-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #666;
}

.rel-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 4px;
}

.rel-weight {
  width: 40px;
  text-align: right;
  font-family: monospace;
}

.rel-tags {
  color: #888;
  font-style: italic;
}
```

**End State**: Inspector shows relationship graph with visual weight bars, sorted by strength, with tags visible.

---

### Task 10: WebSocket Event Wiring

**Location**: `src/server/transport/WsServer.ts`, `src/client/index.ts`

**Instructions**:

1. Server: Emit conversation events:

```typescript
// In WsServer.ts or simulation event emitter

emitConversationStart(conv: ConversationData, gameTime: GameTime): void {
  this.broadcast({
    type: 'conversationStart',
    conversationId: conv.id,
    participants: conv.participants,
    location: conv.location,
    gameTime
  });
}

emitConversationTurn(
  conversationId: string,
  speakerId: string,
  message: string,
  gameTime: GameTime
): void {
  this.broadcast({
    type: 'conversationTurn',
    conversationId,
    speakerId,
    message,
    gameTime
  });

  // Also emit speech bubble event
  this.broadcast({
    type: 'speechBubble',
    agentId: speakerId,
    message,
    duration: Math.min(message.length * 50, 5000) // Duration based on message length
  });
}

emitConversationEnd(
  conversationId: string,
  reason: string,
  gameTime: GameTime
): void {
  this.broadcast({
    type: 'conversationEnd',
    conversationId,
    reason,
    gameTime
  });
}
```

2. Client: Handle conversation events:

```typescript
// In client WebSocket handler

socket.on('message', (data) => {
  const event = JSON.parse(data);

  switch (event.type) {
    case 'conversationStart':
      logPanel.addEntry({
        type: 'conversationStart',
        conversationId: event.conversationId,
        participants: event.participants.map(id => ({
          id,
          name: getAgentName(id)
        })),
        location: getLocationName(event.location),
        timestamp: event.gameTime
      });
      break;

    case 'conversationTurn':
      logPanel.addEntry({
        type: 'dialogue',
        conversationId: event.conversationId,
        speakerId: event.speakerId,
        speakerName: getAgentName(event.speakerId),
        listenerId: getOtherParticipant(event.conversationId, event.speakerId),
        listenerName: getAgentName(getOtherParticipant(event.conversationId, event.speakerId)),
        message: event.message,
        timestamp: event.gameTime
      });
      break;

    case 'speechBubble':
      speechBubbleManager.showBubble(
        event.agentId,
        event.message,
        event.duration
      );
      break;

    case 'conversationEnd':
      logPanel.addEntry({
        type: 'conversationEnd',
        conversationId: event.conversationId,
        reason: event.reason,
        timestamp: event.gameTime
      });
      break;
  }
});
```

**End State**: All conversation events flow from server to client and update both speech bubbles and log panel.

---

## Dependencies

### NPM Packages (already in project)
- `zod` - JSON schema validation
- `ws` - WebSocket server
- `uuid` - Conversation ID generation (add if not present)

### Internal Dependencies
- Phase 4 MemoryStream for storing propagated facts
- Phase 3 OllamaClient and PromptTemplates for LLM dialogue
- Phase 2 TimeManager for game time
- Phase 1 AgentSprite for bubble positioning

## Potential Challenges

1. **LLM Response Latency**: Dialogue turns may take 5-10 seconds. Mitigation: Show "thinking" indicator, use generous timeouts, fallback to rule-based responses.

2. **Conversation Overlap**: Two agents might both try to start conversations simultaneously. Mitigation: ConversationManager locks agents immediately on start.

3. **Memory Growth**: Conversations generate many memories. Mitigation: Summarize completed conversations into single memory entries.

4. **Speech Bubble Readability**: Long messages may be hard to read. Mitigation: Truncate display, full text in log panel.

5. **Relationship Drift**: Weights may plateau at extremes. Mitigation: Diminishing returns at +/-80, natural decay over time.

## Success Criteria

1. ✅ Two agents can engage in a 4-8 turn conversation without blocking other agents
2. ✅ Conversation uses LLM when available, falls back to rule-based dialogue
3. ✅ Relationship weights change after conversation (verify with inspector)
4. ✅ Facts shared in conversation appear in receiver's memory stream
5. ✅ Speech bubbles display above agents and disappear after timeout
6. ✅ Log panel shows all dialogue with timestamps and speaker names
7. ✅ Multiple conversations can occur simultaneously between different pairs
8. ✅ Conversations end gracefully on timeout, max turns, or agent signal

## Testing Checklist

### Unit Tests
- [ ] ConversationManager.startConversation creates valid state
- [ ] ConversationManager.addTurn advances turns correctly
- [ ] ConversationManager.checkTimeouts detects stale turns
- [ ] RelationshipManager.updateFromConversation changes weights
- [ ] DialogueFallback generates valid responses
- [ ] Fact extraction finds patterns in messages

### Integration Tests
- [ ] Full conversation flow with mock LLM responses
- [ ] Conversation triggers based on proximity simulation
- [ ] Memory propagation after conversation
- [ ] WebSocket event emission and client handling

### Manual Testing
- [ ] Run 30-minute simulation, verify conversations occur naturally
- [ ] Check relationship changes in inspector before/after conversations
- [ ] Verify speech bubbles appear and disappear correctly
- [ ] Confirm log panel shows all dialogue entries
- [ ] Test LLM timeout fallback by stopping Ollama mid-conversation

## File Summary

### New Files to Create
- `src/server/agents/behaviors/Conversation.ts` - ConversationManager class
- `src/server/agents/behaviors/Relationships.ts` - RelationshipManager class
- `src/server/agents/behaviors/DialogueFallback.ts` - Rule-based dialogue
- `src/client/game/sprites/SpeechBubble.ts` - Phaser speech bubble
- `src/client/game/sprites/SpeechBubbleManager.ts` - Bubble lifecycle management

### Files to Modify
- `src/shared/Types.ts` - Add conversation and relationship types
- `src/shared/Events.ts` - Add conversation event schemas
- `src/server/llm/PromptTemplates.ts` - Add dialogue prompt builder
- `src/server/llm/ResponseSchemas.ts` - Add dialogue response schema
- `src/server/simulation/Simulation.ts` - Integrate conversation processing
- `src/server/transport/WsServer.ts` - Emit conversation events
- `src/client/ui/LogPanel.ts` - Render dialogue entries
- `src/client/ui/InspectorPanel.ts` - Show relationships
- `src/client/index.ts` - Handle conversation WebSocket events
