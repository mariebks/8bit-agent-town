import {
  ControlEvent,
  ConversationEndEvent,
  ConversationTurnEvent,
  DeltaEvent,
  LocationArrivalEvent,
  LogEvent,
  RelationshipShiftEvent,
  ServerEvent,
  SnapshotEvent,
} from '@shared/Events';
import { AgentData, AgentId, ConversationData, GameTime, TilePosition } from '@shared/Types';
import { TICK_INTERVAL_MS } from '@shared/Constants';
import { Agent } from '../agents/Agent';
import { AgentGenerator } from '../agents/AgentGenerator';
import { AgentManager } from '../agents/AgentManager';
import { PlanningSystem } from '../agents/cognition/Plan';
import { ReflectionSystem } from '../agents/cognition/Reflect';
import { DecisionMaker } from '../agents/DecisionMaker';
import { ConversationManager } from '../agents/behaviors/Conversation';
import { RelationshipManager } from '../agents/behaviors/Relationships';
import { OllamaClient, RequestQueue } from '../llm';
import { Memory, MemoryStream, MemorySource, Pruner } from '../memory';
import { RollingStats } from '../util/RollingStats';
import { SeededRng } from '../util/SeededRng';
import { NavGrid, TiledMapData } from '../world/NavGrid';
import { Pathfinding } from '../world/Pathfinding';
import { Town } from '../world/Town';
import { TimeManager } from './TimeManager';

interface SimulationConfig {
  seed: number;
  agentCount: number;
  llmEnabled: boolean;
}

const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  agentCount: 20,
  llmEnabled: true,
};

type ConversationIntent = 'bond' | 'inform' | 'coordinate' | 'vent';
type ConversationTone = 'warm' | 'neutral' | 'tense';
type ConversationArc = 'opening' | 'exploring' | 'resolving' | 'closing';

interface ConversationState {
  topic: string;
  intent: ConversationIntent;
  tone: ConversationTone;
  turnGoal: string;
  conversationArc: ConversationArc;
  lastLines: string[];
}

const FALLBACK_TOPICS = [
  'today plans',
  'town gossip',
  'market prices',
  'weather shifts',
  'work progress',
  'park activity',
];

export class Simulation {
  readonly timeManager: TimeManager;
  readonly agentManager: AgentManager;

  private readonly town: Town;
  private readonly navGrid: NavGrid;
  private readonly pathfinding: Pathfinding;
  private readonly decisionMaker: DecisionMaker;
  private readonly planningSystem: PlanningSystem;
  private readonly reflectionSystem: ReflectionSystem;
  private readonly conversationManager: ConversationManager;
  private readonly relationships: RelationshipManager;
  private readonly memoryByAgent = new Map<AgentId, MemoryStream>();
  private readonly pruner = new Pruner();
  private readonly rng: SeededRng;
  private readonly llmQueue: RequestQueue;
  private readonly llmClient: OllamaClient | undefined;

  private readonly walkableWaypoints: TilePosition[];
  private readonly tickStats = new RollingStats(600);
  private readonly queuedServerEvents: ServerEvent[] = [];
  private readonly recentLogEvents: LogEvent[] = [];
  private readonly lastLocationByAgent = new Map<AgentId, string | null>();
  private readonly conversationStateById = new Map<string, ConversationState>();
  private readonly knownTopicsByAgent = new Map<AgentId, Map<string, number>>();
  private readonly topicLastMentioned = new Map<string, number>();

  constructor(mapData: TiledMapData, config: Partial<SimulationConfig> = {}) {
    const resolvedConfig = { ...DEFAULT_CONFIG, ...config };

    this.rng = new SeededRng(resolvedConfig.seed);
    this.timeManager = new TimeManager(8 * 60);
    this.navGrid = NavGrid.fromTiledMap(mapData);
    this.pathfinding = new Pathfinding(this.navGrid);
    this.town = new Town();

    this.decisionMaker = new DecisionMaker(resolvedConfig.seed + 7, {
      llmEnabledAgents: Math.min(3, resolvedConfig.agentCount),
    });
    this.planningSystem = new PlanningSystem(resolvedConfig.seed + 17);
    this.reflectionSystem = new ReflectionSystem(12);
    this.conversationManager = new ConversationManager();
    this.relationships = new RelationshipManager();

    this.llmQueue = new RequestQueue({ concurrency: 1 });
    this.llmClient = resolvedConfig.llmEnabled ? new OllamaClient() : undefined;

    const agentGenerator = new AgentGenerator(resolvedConfig.seed + 13);
    const profiles = agentGenerator.generate(resolvedConfig.agentCount, this.town.getAllLocations());

    const agents: Agent[] = profiles.map((profile) => {
      const spawnPoint = this.town.getLocation(profile.homeLocation)?.spawnPoint ?? { tileX: 3, tileY: 3 };
      const agent = new Agent(profile, spawnPoint);
      this.memoryByAgent.set(profile.id, new MemoryStream(profile.id));
      return agent;
    });

    this.agentManager = new AgentManager(agents);
    this.relationships.initialize(
      agents.map((agent) => agent.id),
      this.timeManager.getGameTime().totalMinutes,
    );
    for (const agent of agents) {
      this.lastLocationByAgent.set(agent.id, this.town.getLocationAtPosition(agent.getTilePosition())?.id ?? null);
      this.knownTopicsByAgent.set(agent.id, new Map<string, number>());
      this.seedAgentTopics(agent.id, agent.profile.interests);
    }

    this.walkableWaypoints = this.buildWaypointSample(180);

    this.timeManager.onDayBoundary((gameTime) => {
      for (const agent of this.agentManager.getAll()) {
        const stream = this.memoryByAgent.get(agent.id);
        if (!stream) {
          continue;
        }

        stream.addReflection(`A new day begins. ${agent.name} considers priorities.`, gameTime.totalMinutes);
      }
    });
  }

  applyControl(event: ControlEvent): boolean {
    if (event.action === 'pause') {
      this.timeManager.pause();
      return true;
    }

    if (event.action === 'resume') {
      this.timeManager.resume();
      return true;
    }

    if (event.action === 'setSpeed') {
      const allowed = new Set([1, 2, 4, 10]);
      const value = event.value ?? 1;
      if (allowed.has(value)) {
        this.timeManager.setSpeed(value as 1 | 2 | 4 | 10);
        return true;
      }

      return false;
    }

    return false;
  }

  tick(tickId: number): void {
    const startedAt = performance.now();

    if (this.timeManager.isPaused()) {
      this.tickStats.push(performance.now() - startedAt);
      return;
    }

    this.timeManager.tick(1);
    const gameTime = this.timeManager.getGameTime();

    this.runCognition(gameTime);
    this.agentManager.update(TICK_INTERVAL_MS);

    const decisionLogs = this.decisionMaker.update({
      tickId,
      gameTime,
      agentManager: this.agentManager,
      pathfinding: this.pathfinding,
      walkableWaypoints: this.walkableWaypoints,
      town: this.town,
      llmClient: this.llmClient,
      llmQueue: this.llmQueue,
      memoryByAgent: this.memoryByAgent,
    });

    for (const log of decisionLogs) {
      this.enqueueServerEvent(log);
    }

    this.tryStartConversations(gameTime);
    this.runConversationTurns(gameTime);
    this.syncConversationStates();
    this.emitLocationArrivalEvents(gameTime);

    if (tickId % 120 === 0) {
      for (const stream of this.memoryByAgent.values()) {
        this.pruner.compact(stream, gameTime.totalMinutes);
      }
    }

    const tickDurationMs = performance.now() - startedAt;
    this.tickStats.push(tickDurationMs);
  }

  createSnapshotEvent(tickId: number): SnapshotEvent {
    return {
      type: 'snapshot',
      tickId,
      gameTime: this.timeManager.getGameTime(),
      agents: this.buildAgentDataPayload(),
      events: this.drainServerEvents(),
      metrics: this.getMetrics(),
    };
  }

  createDeltaEvent(tickId: number): DeltaEvent {
    return {
      type: 'delta',
      tickId,
      gameTime: this.timeManager.getGameTime(),
      agents: this.buildAgentDataPayload(),
      events: this.drainServerEvents(),
      metrics: this.getMetrics(),
    };
  }

  getRecentLogs(): LogEvent[] {
    return [...this.recentLogEvents];
  }

  async waitForIdle(): Promise<void> {
    await this.llmQueue.onIdle();
  }

  private tryStartConversations(gameTime: GameTime): void {
    for (const [left, right] of this.agentManager.getNearbyPairs(1)) {
      const relationshipWeight = this.relationships.getWeight(left.id, right.id);
      if (!this.conversationManager.canStartConversation(left.id, right.id, gameTime.totalMinutes, relationshipWeight)) {
        continue;
      }

      if (!this.rng.chance(0.08)) {
        continue;
      }

      const location = this.town.getLocationAtPosition(left.getTilePosition())?.id ?? 'plaza';
      const started = this.conversationManager.startConversation(
        left.id,
        right.id,
        location,
        gameTime,
        relationshipWeight,
      );
      if (!started) {
        continue;
      }

      this.enqueueServerEvent(started);
      this.initializeConversationState(started.conversationId, left.id, right.id, location, gameTime);

      const leftMemory = this.memoryByAgent.get(left.id);
      leftMemory?.addObservation({
        content: `${left.name} started a conversation with ${right.name}.`,
        gameTime: gameTime.totalMinutes,
        location,
        subjects: [left.id, right.id],
        source: MemorySource.Dialogue,
        importance: 6,
      });

      const rightMemory = this.memoryByAgent.get(right.id);
      rightMemory?.addObservation({
        content: `${right.name} started a conversation with ${left.name}.`,
        gameTime: gameTime.totalMinutes,
        location,
        subjects: [right.id, left.id],
        source: MemorySource.Dialogue,
        importance: 6,
      });
    }
  }

  private runConversationTurns(gameTime: GameTime): void {
    const activeMap = new Map(this.conversationManager.getActiveConversations().map((conversation) => [conversation.id, conversation]));

    const result = this.conversationManager.tick(gameTime, ({ speakerId, listenerId, turnNumber, timedOut }) => {
      if (timedOut) {
        return 'Queue is busy. Let us continue later.';
      }

      const conversation = this.conversationManager.getAgentConversation(speakerId);
      if (!conversation) {
        return 'I lost my train of thought.';
      }

      return this.composeConversationTurn(conversation, speakerId, listenerId, turnNumber, gameTime);
    });

    for (const turnEvent of result.turnEvents) {
      this.handleConversationTurnEvent(turnEvent, activeMap, gameTime);
      this.enqueueServerEvent(turnEvent);
    }

    for (const speechEvent of result.speechEvents) {
      this.enqueueServerEvent(speechEvent);
    }

    for (const endEvent of result.endEvents) {
      this.enqueueServerEvent(endEvent);
      this.conversationStateById.delete(endEvent.conversationId);
    }

    this.endConversationsNaturally(gameTime);
  }

  private handleConversationTurnEvent(
    turnEvent: ConversationTurnEvent,
    activeMap: Map<string, { participants: [AgentId, AgentId]; location: string }>,
    gameTime: GameTime,
  ): void {
    const conversation = activeMap.get(turnEvent.conversationId);
    if (!conversation) {
      return;
    }

    const [participantA, participantB] = conversation.participants;
    const listenerId = participantA === turnEvent.speakerId ? participantB : participantA;

    const shifts = this.relationships.applyConversationDelta(turnEvent.speakerId, listenerId, 2, gameTime.totalMinutes);
    for (const shift of shifts) {
      const relationshipEvent: RelationshipShiftEvent = {
        type: 'relationshipShift',
        sourceId: shift.sourceId,
        targetId: shift.targetId,
        fromWeight: shift.fromWeight,
        toWeight: shift.toWeight,
        stance: shift.stance,
        gameTime,
      };
      this.enqueueServerEvent(relationshipEvent);
    }

    const speaker = this.agentManager.getById(turnEvent.speakerId);
    const listener = this.agentManager.getById(listenerId);

    const propagatedMemoryText = `${speaker?.name ?? turnEvent.speakerId} said: ${turnEvent.message}`;

    this.memoryByAgent.get(listenerId)?.addObservation({
      content: propagatedMemoryText,
      gameTime: gameTime.totalMinutes,
      location: conversation.location,
      subjects: [turnEvent.speakerId, listenerId],
      source: MemorySource.Social,
      confidence: 0.8,
      hopCount: 1,
      importance: 5,
    });

    this.memoryByAgent.get(turnEvent.speakerId)?.addObservation({
      content: `I told ${listener?.name ?? listenerId}: ${turnEvent.message}`,
      gameTime: gameTime.totalMinutes,
      location: conversation.location,
      subjects: [turnEvent.speakerId, listenerId],
      source: MemorySource.Dialogue,
      importance: 5,
    });

    this.registerTopicsFromTurn(turnEvent.speakerId, listenerId, turnEvent.message, gameTime.totalMinutes);
  }

  private syncConversationStates(): void {
    for (const agent of this.agentManager.getAll()) {
      agent.setConversing(false);
    }

    for (const conversation of this.conversationManager.getActiveConversations()) {
      const [a, b] = conversation.participants;
      this.agentManager.getById(a)?.setConversing(true);
      this.agentManager.getById(b)?.setConversing(true);
    }
  }

  private emitLocationArrivalEvents(gameTime: GameTime): void {
    for (const agent of this.agentManager.getAll()) {
      const currentLocation = this.town.getLocationAtPosition(agent.getTilePosition())?.id ?? null;
      const previousLocation = this.lastLocationByAgent.get(agent.id) ?? null;

      if (currentLocation && currentLocation !== previousLocation) {
        const event: LocationArrivalEvent = {
          type: 'locationArrival',
          agentId: agent.id,
          locationId: currentLocation,
          gameTime,
        };
        this.enqueueServerEvent(event);
      }

      this.lastLocationByAgent.set(agent.id, currentLocation);
    }
  }

  private initializeConversationState(
    conversationId: string,
    speakerId: AgentId,
    listenerId: AgentId,
    location: string,
    gameTime: GameTime,
  ): void {
    const topic = this.pickConversationTopic(speakerId, listenerId, location, gameTime.totalMinutes);
    const relationship = this.relationships.getWeight(speakerId, listenerId);
    const tone: ConversationTone = relationship >= 45 ? 'warm' : relationship <= -20 ? 'tense' : 'neutral';
    const intent: ConversationIntent = relationship >= 35 ? 'bond' : relationship <= -10 ? 'vent' : 'inform';

    this.conversationStateById.set(conversationId, {
      topic,
      intent,
      tone,
      turnGoal: `introduce ${topic}`,
      conversationArc: 'opening',
      lastLines: [],
    });
    this.noteTopicMention(topic, gameTime.totalMinutes, speakerId, 0.7);
    this.noteTopicMention(topic, gameTime.totalMinutes, listenerId, 0.7);
  }

  private composeConversationTurn(
    conversation: ConversationData,
    speakerId: AgentId,
    listenerId: AgentId,
    turnNumber: number,
    gameTime: GameTime,
  ): string {
    const state = this.conversationStateById.get(conversation.id);
    if (!state) {
      this.initializeConversationState(conversation.id, speakerId, listenerId, conversation.location, gameTime);
      return this.composeConversationTurn(conversation, speakerId, listenerId, turnNumber, gameTime);
    }

    const listener = this.agentManager.getById(listenerId);
    const listenerName = listener?.name ?? listenerId;
    const memoryHint = this.pickRelevantMemoryHint(speakerId, state.topic, gameTime.totalMinutes);
    const planPressureHint = this.pickPlanPressureHint(speakerId, gameTime.totalMinutes);

    const arc = this.resolveConversationArc(turnNumber);
    state.conversationArc = arc;
    state.turnGoal = this.resolveTurnGoal(arc, state.intent, state.topic);

    const phrase = this.composeLineFromArc({
      arc,
      topic: state.topic,
      tone: state.tone,
      intent: state.intent,
      listenerName,
      memoryHint,
      planPressureHint,
    });

    const safeLine = this.rewriteIfRepetitive(phrase, state);
    state.lastLines.push(safeLine);
    if (state.lastLines.length > 4) {
      state.lastLines.shift();
    }

    const extractedTopics = extractTopics(safeLine).slice(0, 2);
    for (const topic of extractedTopics) {
      this.noteTopicMention(topic, gameTime.totalMinutes, speakerId, 0.8);
      this.noteTopicMention(topic, gameTime.totalMinutes, listenerId, 0.6);
    }

    return safeLine;
  }

  private composeLineFromArc(input: {
    arc: ConversationArc;
    topic: string;
    tone: ConversationTone;
    intent: ConversationIntent;
    listenerName: string;
    memoryHint: string;
    planPressureHint: string;
  }): string {
    const tonePrefix =
      input.tone === 'warm'
        ? this.rng.pick(['Hey', 'Glad you are here', 'Good to see you'])
        : input.tone === 'tense'
          ? this.rng.pick(['Listen', 'Honestly', 'I need to say this'])
          : this.rng.pick(['By the way', 'Quick thought', 'I was thinking']);

    if (input.arc === 'opening') {
      return `${tonePrefix} ${input.listenerName}, about ${input.topic}: ${input.memoryHint}.`;
    }

    if (input.arc === 'exploring') {
      return `${input.topic} still matters. ${input.memoryHint}; maybe we should ${intentToVerb(input.intent)}.`;
    }

    if (input.arc === 'resolving') {
      return `For ${input.topic}, I suggest we ${intentToVerb(input.intent)} and keep it simple.`;
    }

    return `Let's pause ${input.topic} for now; ${input.planPressureHint}.`;
  }

  private rewriteIfRepetitive(candidate: string, state: ConversationState): string {
    const normalizedCandidate = normalizeDialogue(candidate);
    const duplicate = state.lastLines.some((line) => similarity(normalizeDialogue(line), normalizedCandidate) >= 0.84);
    if (!duplicate) {
      return candidate.slice(0, 120);
    }

    const fallback = this.rng.pick([
      `New angle: ${state.topic} could change tomorrow.`,
      `Let us revisit ${state.topic} after we gather more details.`,
      `I do not want to loop on ${state.topic}; we can test a small step first.`,
    ]);
    return fallback.slice(0, 120);
  }

  private resolveConversationArc(turnNumber: number): ConversationArc {
    if (turnNumber === 0) {
      return 'opening';
    }
    if (turnNumber <= 2) {
      return 'exploring';
    }
    if (turnNumber <= 4) {
      return 'resolving';
    }
    return 'closing';
  }

  private resolveTurnGoal(arc: ConversationArc, intent: ConversationIntent, topic: string): string {
    if (arc === 'opening') {
      return `set context for ${topic}`;
    }
    if (arc === 'exploring') {
      return `${intentToVerb(intent)} on ${topic}`;
    }
    if (arc === 'resolving') {
      return `agree on next step for ${topic}`;
    }
    return `close ${topic} naturally`;
  }

  private pickConversationTopic(speakerId: AgentId, listenerId: AgentId, location: string, gameMinute: number): string {
    const speakerTopics = this.knownTopicsByAgent.get(speakerId) ?? new Map<string, number>();
    const listenerTopics = this.knownTopicsByAgent.get(listenerId) ?? new Map<string, number>();
    const candidates = new Set<string>([
      ...speakerTopics.keys(),
      ...listenerTopics.keys(),
      ...this.extractMemoryTopics(speakerId, gameMinute),
      ...this.extractMemoryTopics(listenerId, gameMinute),
      ...FALLBACK_TOPICS,
      location.replace(/_/g, ' '),
    ]);

    let bestTopic = 'today plans';
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const topic of candidates) {
      const score = this.scoreTopicChoice(topic, speakerTopics.get(topic) ?? 0, listenerTopics.get(topic) ?? 0, gameMinute);
      if (score > bestScore) {
        bestTopic = topic;
        bestScore = score;
      }
    }

    return bestTopic;
  }

  private scoreTopicChoice(topic: string, speakerConfidence: number, listenerConfidence: number, gameMinute: number): number {
    const recentMention = this.topicLastMentioned.get(topic) ?? Number.NEGATIVE_INFINITY;
    const freshness = Number.isFinite(recentMention) ? Math.min(2, (gameMinute - recentMention) / 180) : 2;
    const novelty = 1 - Math.min(1, (speakerConfidence + listenerConfidence) / 2);
    return freshness * 1.2 + novelty + this.rng.next() * 0.2;
  }

  private extractMemoryTopics(agentId: AgentId, gameMinute: number): string[] {
    const stream = this.memoryByAgent.get(agentId);
    if (!stream) {
      return [];
    }

    const scored = stream.retrieveTopK('important topics', gameMinute, 4, ['plan', 'conversation', 'social']);
    return scored.flatMap((item) => extractTopics(item.memory.content)).slice(0, 5);
  }

  private pickRelevantMemoryHint(agentId: AgentId, topic: string, gameMinute: number): string {
    const stream = this.memoryByAgent.get(agentId);
    if (!stream) {
      return `I keep noticing ${topic}`;
    }

    const context = stream.retrieveTopK(topic, gameMinute, 1, [topic]);
    const top = context[0]?.memory;
    if (!top) {
      return `I have been thinking about ${topic}`;
    }

    return summarizeMemory(top);
  }

  private pickPlanPressureHint(agentId: AgentId, gameMinute: number): string {
    const memory = this.memoryByAgent.get(agentId);
    if (!memory) {
      return 'I have another task queued';
    }

    const nextGoal = this.planningSystem.getCurrentGoal(memory, gameMinute);
    if (!nextGoal) {
      return 'I want to check on my routine soon';
    }
    return `I should get back to "${nextGoal.toLowerCase()}"`;
  }

  private registerTopicsFromTurn(speakerId: AgentId, listenerId: AgentId, message: string, gameMinute: number): void {
    const topics = extractTopics(message).slice(0, 3);
    if (topics.length === 0) {
      return;
    }

    for (const topic of topics) {
      this.noteTopicMention(topic, gameMinute, speakerId, 0.85);
      this.noteTopicMention(topic, gameMinute, listenerId, 0.7);
    }
  }

  private noteTopicMention(topic: string, gameMinute: number, agentId: AgentId, confidence: number): void {
    const normalizedTopic = topic.toLowerCase();
    const topicMap = this.knownTopicsByAgent.get(agentId) ?? new Map<string, number>();
    const previous = topicMap.get(normalizedTopic) ?? 0;
    const next = Math.min(1, previous * 0.7 + confidence * 0.6);
    topicMap.set(normalizedTopic, next);
    this.knownTopicsByAgent.set(agentId, topicMap);
    this.topicLastMentioned.set(normalizedTopic, gameMinute);
  }

  private seedAgentTopics(agentId: AgentId, topics: string[]): void {
    const topicMap = this.knownTopicsByAgent.get(agentId) ?? new Map<string, number>();
    for (const topic of topics) {
      topicMap.set(topic.toLowerCase(), 0.45);
    }
    this.knownTopicsByAgent.set(agentId, topicMap);
  }

  private endConversationsNaturally(gameTime: GameTime): void {
    const candidates = this.conversationManager.getActiveConversations();
    const generatedEnds: ConversationEndEvent[] = [];

    for (const conversation of candidates) {
      const state = this.conversationStateById.get(conversation.id);
      if (!state) {
        continue;
      }

      const turnCount = conversation.turns.length;
      if (turnCount < 2) {
        continue;
      }

      const [a, b] = conversation.participants;
      const schedulePressure = this.hasSchedulePressure(a, gameTime.totalMinutes) || this.hasSchedulePressure(b, gameTime.totalMinutes);
      const shouldCloseByTopic = state.conversationArc === 'closing' && this.rng.chance(0.28);
      const shouldCloseBySchedule = schedulePressure && this.rng.chance(0.35);
      const shouldCloseByDiscomfort = state.tone === 'tense' && turnCount >= 3 && this.rng.chance(0.22);

      if (shouldCloseBySchedule) {
        generatedEnds.push(this.conversationManager.endConversation(conversation.id, 'schedulePressure', gameTime));
        continue;
      }

      if (shouldCloseByDiscomfort) {
        generatedEnds.push(this.conversationManager.endConversation(conversation.id, 'socialDiscomfort', gameTime));
        continue;
      }

      if (shouldCloseByTopic) {
        generatedEnds.push(this.conversationManager.endConversation(conversation.id, 'topicExhausted', gameTime));
      }
    }

    for (const endEvent of generatedEnds) {
      this.conversationStateById.delete(endEvent.conversationId);
      this.enqueueServerEvent(endEvent);
    }
  }

  private hasSchedulePressure(agentId: AgentId, gameMinute: number): boolean {
    const stream = this.memoryByAgent.get(agentId);
    if (!stream) {
      return false;
    }

    const plan = stream.getCurrentPlan(gameMinute);
    if (!plan) {
      return false;
    }

    return plan.planItems.some((item) => {
      if (item.status !== 'pending' && item.status !== 'active') {
        return false;
      }
      if (typeof item.targetTime !== 'number') {
        return false;
      }
      return item.targetTime - gameMinute <= 30;
    });
  }

  private enqueueServerEvent(event: ServerEvent): void {
    this.queuedServerEvents.push(event);
    if (event.type === 'log') {
      this.recentLogEvents.push(event);
      if (this.recentLogEvents.length > 500) {
        this.recentLogEvents.splice(0, this.recentLogEvents.length - 500);
      }
    }
  }

  private drainServerEvents(): ServerEvent[] {
    if (this.queuedServerEvents.length === 0) {
      return [];
    }

    const events = [...this.queuedServerEvents];
    this.queuedServerEvents.length = 0;
    return events;
  }

  private getMetrics() {
    const pathCache = this.pathfinding.getCacheStats();
    const queueMetrics = this.llmQueue.getMetrics();

    return {
      tickDurationMsP50: this.tickStats.percentile(50),
      tickDurationMsP95: this.tickStats.percentile(95),
      tickDurationMsP99: this.tickStats.percentile(99),
      queueDepth: this.llmQueue.size() + this.llmQueue.pending(),
      queueDropped: this.llmQueue.dropped(),
      llmFallbackRate: this.decisionMaker.getFallbackRate(),
      llmQueueMaxDepth: queueMetrics.maxSizeReached,
      llmQueueAvgWaitMs: queueMetrics.averageWaitTimeMs,
      llmQueueAvgProcessMs: queueMetrics.averageProcessTimeMs,
      llmQueueBackpressure: this.llmQueue.getBackpressureLevel(),
      llmQueueHealthy: this.llmQueue.isHealthy(),
      pathCacheSize: pathCache.size,
      pathCacheHitRate: pathCache.hitRate,
    };
  }

  private runCognition(gameTime: GameTime): void {
    for (const agent of this.agentManager.getAll()) {
      const memory = this.memoryByAgent.get(agent.id);
      if (!memory) {
        continue;
      }

      const planning = this.planningSystem.ensureDailyPlan(agent, memory, gameTime, this.town.getAllLocations());
      if (planning.log) {
        this.enqueueServerEvent(planning.log);
      }

      const reflection = this.reflectionSystem.maybeReflect(agent, memory, gameTime);
      if (reflection.log) {
        this.enqueueServerEvent(reflection.log);
      }
    }
  }

  private buildAgentDataPayload(): AgentData[] {
    const currentGameTime = this.timeManager.getGameTime().totalMinutes;

    return this.agentManager.getAll().map((agent) => {
      const payload = agent.toAgentData();
      const locationId = this.town.getLocationAtPosition(payload.tilePosition)?.id;
      const memory = this.memoryByAgent.get(agent.id);
      const goal = memory ? this.planningSystem.getCurrentGoal(memory, currentGameTime) : null;
      const planPreview = memory ? this.planningSystem.getPlanPreview(memory, currentGameTime, 3) : [];
      const lastReflection = memory ? this.reflectionSystem.getLatestReflection(memory) : null;
      const relationshipSummary = this.relationships.getSummary(agent.id);
      const llmTrace = this.decisionMaker.getLlmTrace(agent.id);

      return {
        ...payload,
        currentLocationId: locationId,
        currentGoal: goal ?? undefined,
        currentPlan: planPreview.length > 0 ? planPreview : undefined,
        lastReflection: lastReflection ?? undefined,
        relationshipSummary,
        llmTrace,
      };
    });
  }

  private buildWaypointSample(maxCount: number): TilePosition[] {
    const tiles = this.navGrid.getRandomWalkableTiles(maxCount * 2);
    const sampled: TilePosition[] = [];

    while (sampled.length < maxCount && tiles.length > 0) {
      const index = this.rng.nextInt(tiles.length);
      sampled.push(tiles[index]);
      tiles.splice(index, 1);
    }

    return sampled;
  }
}

function intentToVerb(intent: ConversationIntent): string {
  if (intent === 'bond') {
    return 'sync up';
  }
  if (intent === 'coordinate') {
    return 'coordinate quickly';
  }
  if (intent === 'vent') {
    return 'clear the air';
  }
  return 'share notes';
}

function summarizeMemory(memory: Memory): string {
  const base = memory.content
    .replace(/I told [^:]+:\s*/i, '')
    .replace(/^[^.?!]{90,}[.?!].*$/, (value) => value.slice(0, 90))
    .trim();

  if (base.length === 0) {
    return 'something from earlier still stands out';
  }

  return base.length > 92 ? `${base.slice(0, 89)}...` : base;
}

function extractTopics(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !STOPWORDS.has(token));

  return [...new Set(tokens)].slice(0, 6);
}

function normalizeDialogue(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftSet = new Set(left.split(' '));
  const rightSet = new Set(right.split(' '));
  const intersection = [...leftSet].filter((word) => rightSet.has(word)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'been',
  'from',
  'have',
  'just',
  'later',
  'maybe',
  'need',
  'that',
  'there',
  'they',
  'this',
  'through',
  'today',
  'want',
  'with',
]);
