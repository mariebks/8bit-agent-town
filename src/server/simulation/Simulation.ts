import { DeltaEvent, LogEvent, SnapshotEvent, ServerEvent, ControlEvent, ConversationTurnEvent } from '@shared/Events';
import { AgentData, AgentId, GameTime, TilePosition } from '@shared/Types';
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
import { MemoryStream, MemorySource, Pruner } from '../memory';
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

      const speaker = this.agentManager.getById(speakerId);
      const listener = this.agentManager.getById(listenerId);
      const opener = turnNumber === 0 ? 'Hey' : this.rng.pick(['I think', 'Honestly', 'By the way', 'Maybe']);
      const topic = this.rng.pick(['the town', 'work', 'today\'s plans', 'the market', 'the weather']);
      const speakerName = speaker?.name ?? speakerId;
      const listenerName = listener?.name ?? listenerId;

      return `${opener} ${listenerName}, ${speakerName} is thinking about ${topic}.`;
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
    }
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

    this.relationships.applyConversationDelta(turnEvent.speakerId, listenerId, 2, gameTime.totalMinutes);

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
