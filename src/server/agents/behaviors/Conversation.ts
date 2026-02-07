import { AgentId, ConversationData, ConversationId, GameTime, LocationId } from '@shared/Types';
import { ConversationEndEvent, ConversationStartEvent, ConversationTurnEvent, SpeechBubbleEvent } from '@shared/Events';

export type ConversationEndReason =
  | 'maxTurns'
  | 'agentEnded'
  | 'timeout'
  | 'interrupted'
  | 'topicExhausted'
  | 'schedulePressure'
  | 'socialDiscomfort';

interface ActiveConversation {
  data: ConversationData;
  currentSpeaker: AgentId;
  turnDeadlineGameMinute: number;
  turnNumber: number;
  completed: boolean;
}

export interface ConversationConfig {
  maxTurns: number;
  turnTimeoutMinutes: number;
  cooldownMinutes: number;
  minRelationshipWeight: number;
}

const DEFAULT_CONFIG: ConversationConfig = {
  maxTurns: 8,
  turnTimeoutMinutes: 10,
  cooldownMinutes: 30,
  minRelationshipWeight: -50,
};

export class ConversationManager {
  private readonly config: ConversationConfig;
  private readonly activeById = new Map<ConversationId, ActiveConversation>();
  private readonly byAgent = new Map<AgentId, ConversationId>();
  private readonly pairCooldownUntil = new Map<string, number>();
  private sequence = 0;

  constructor(config: Partial<ConversationConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  isAgentAvailable(agentId: AgentId): boolean {
    return !this.byAgent.has(agentId);
  }

  canStartConversation(agentA: AgentId, agentB: AgentId, gameMinute: number, relationshipWeight: number): boolean {
    if (!this.isAgentAvailable(agentA) || !this.isAgentAvailable(agentB)) {
      return false;
    }

    if (relationshipWeight < this.config.minRelationshipWeight) {
      return false;
    }

    const pairKey = this.pairKey(agentA, agentB);
    const cooldownUntil = this.pairCooldownUntil.get(pairKey) ?? -1;
    return gameMinute >= cooldownUntil;
  }

  startConversation(
    agentA: AgentId,
    agentB: AgentId,
    location: LocationId,
    gameTime: GameTime,
    relationshipWeight = 0,
  ): ConversationStartEvent | null {
    if (!this.canStartConversation(agentA, agentB, gameTime.totalMinutes, relationshipWeight)) {
      return null;
    }

    const id = this.nextId();
    const data: ConversationData = {
      id,
      participants: [agentA, agentB],
      turns: [],
      startTime: gameTime.totalMinutes,
      location,
    };

    const active: ActiveConversation = {
      data,
      currentSpeaker: agentA,
      turnDeadlineGameMinute: gameTime.totalMinutes + this.config.turnTimeoutMinutes,
      turnNumber: 0,
      completed: false,
    };

    this.activeById.set(id, active);
    this.byAgent.set(agentA, id);
    this.byAgent.set(agentB, id);

    return {
      type: 'conversationStart',
      conversationId: id,
      participants: [agentA, agentB],
      location,
      gameTime,
    };
  }

  tick(
    gameTime: GameTime,
    resolveTurn: (context: {
      conversation: ConversationData;
      speakerId: AgentId;
      listenerId: AgentId;
      turnNumber: number;
      timedOut: boolean;
    }) => string,
  ): {
    turnEvents: ConversationTurnEvent[];
    speechEvents: SpeechBubbleEvent[];
    endEvents: ConversationEndEvent[];
  } {
    const turnEvents: ConversationTurnEvent[] = [];
    const speechEvents: SpeechBubbleEvent[] = [];
    const endEvents: ConversationEndEvent[] = [];

    for (const active of this.activeById.values()) {
      if (active.completed) {
        continue;
      }

      const [agentA, agentB] = active.data.participants;
      const speakerId = active.currentSpeaker;
      const listenerId = speakerId === agentA ? agentB : agentA;
      const timedOut = gameTime.totalMinutes >= active.turnDeadlineGameMinute;

      const message = resolveTurn({
        conversation: active.data,
        speakerId,
        listenerId,
        turnNumber: active.turnNumber,
        timedOut,
      });

      const cleanMessage = message.trim().slice(0, 120);
      active.data.turns.push({
        speakerId,
        message: cleanMessage,
        timestamp: gameTime.totalMinutes,
      });
      active.turnNumber += 1;
      active.currentSpeaker = listenerId;
      active.turnDeadlineGameMinute = gameTime.totalMinutes + this.config.turnTimeoutMinutes;

      turnEvents.push({
        type: 'conversationTurn',
        conversationId: active.data.id,
        speakerId,
        message: cleanMessage,
        gameTime,
      });

      speechEvents.push({
        type: 'speechBubble',
        agentId: speakerId,
        message: cleanMessage,
        durationTicks: Math.max(6, Math.ceil(cleanMessage.length / 10)),
      });

      if (active.turnNumber >= this.config.maxTurns) {
        endEvents.push(this.endConversation(active.data.id, 'maxTurns', gameTime));
      }
    }

    return {
      turnEvents,
      speechEvents,
      endEvents,
    };
  }

  endConversation(conversationId: ConversationId, reason: ConversationEndReason, gameTime: GameTime): ConversationEndEvent {
    const active = this.activeById.get(conversationId);
    if (!active) {
      return {
        type: 'conversationEnd',
        conversationId,
        reason,
        gameTime,
      };
    }

    active.completed = true;
    active.data.endTime = gameTime.totalMinutes;

    const [agentA, agentB] = active.data.participants;
    this.byAgent.delete(agentA);
    this.byAgent.delete(agentB);

    const pairKey = this.pairKey(agentA, agentB);
    this.pairCooldownUntil.set(pairKey, gameTime.totalMinutes + this.config.cooldownMinutes);
    this.activeById.delete(conversationId);

    return {
      type: 'conversationEnd',
      conversationId,
      reason,
      gameTime,
    };
  }

  getAgentConversation(agentId: AgentId): ConversationData | null {
    const conversationId = this.byAgent.get(agentId);
    if (!conversationId) {
      return null;
    }

    return this.activeById.get(conversationId)?.data ?? null;
  }

  getActiveConversations(): ConversationData[] {
    return [...this.activeById.values()].map((active) => active.data);
  }

  private nextId(): ConversationId {
    this.sequence += 1;
    return `conv-${this.sequence}`;
  }

  private pairKey(agentA: AgentId, agentB: AgentId): string {
    return [agentA, agentB].sort().join(':');
  }
}
