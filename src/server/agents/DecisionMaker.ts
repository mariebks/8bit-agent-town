import { AgentState, GameTime, TilePosition } from '@shared/Types';
import { LogEvent } from '@shared/Events';
import { buildActionPrompt } from '../llm/PromptTemplates';
import { OllamaClient } from '../llm/OllamaClient';
import { RequestQueue } from '../llm/RequestQueue';
import { parseActionResponse } from '../llm/ResponseSchemas';
import { MemoryStream } from '../memory/MemoryStream';
import { SeededRng } from '../util/SeededRng';
import { Pathfinding } from '../world/Pathfinding';
import { Town } from '../world/Town';
import { Agent } from './Agent';
import { AgentManager } from './AgentManager';

interface DecisionContext {
  tickId: number;
  gameTime: GameTime;
  agentManager: AgentManager;
  pathfinding: Pathfinding;
  walkableWaypoints: TilePosition[];
  town: Town;
  llmClient?: OllamaClient;
  llmQueue?: RequestQueue;
  memoryByAgent?: Map<string, MemoryStream>;
}

interface DecisionMakerConfig {
  minDecisionIntervalTicks: number;
  maxDecisionIntervalTicks: number;
  llmEnabledAgents: number;
  llmRequestTtlMs: number;
}

const DEFAULT_CONFIG: DecisionMakerConfig = {
  minDecisionIntervalTicks: 10,
  maxDecisionIntervalTicks: 40,
  llmEnabledAgents: 3,
  llmRequestTtlMs: 3_000,
};

export class DecisionMaker {
  private readonly rng: SeededRng;
  private readonly config: DecisionMakerConfig;
  private readonly pendingLlmByAgent = new Set<string>();
  private readonly deferredLogs: LogEvent[] = [];
  private llmFallbackCount = 0;
  private llmDecisionCount = 0;

  constructor(seed: number, config: Partial<DecisionMakerConfig> = {}) {
    this.rng = new SeededRng(seed);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getFallbackRate(): number {
    if (this.llmDecisionCount === 0) {
      return 0;
    }
    return this.llmFallbackCount / this.llmDecisionCount;
  }

  update(context: DecisionContext): LogEvent[] {
    const events = this.flushDeferredLogs();
    const agents = context.agentManager.getAll();
    const llmEnabledIds = new Set(agents.slice(0, this.config.llmEnabledAgents).map((agent) => agent.id));

    for (const agent of agents) {
      if (agent.getState() === AgentState.Conversing) {
        continue;
      }

      if (context.tickId < agent.getNextDecisionTick()) {
        continue;
      }

      if (llmEnabledIds.has(agent.id) && context.llmClient && context.llmQueue && !this.pendingLlmByAgent.has(agent.id)) {
        this.enqueueLlmDecision(agent, context);
      } else {
        this.applyRuleBasedDecision(agent, context.pathfinding, context.walkableWaypoints);
      }

      agent.setNextDecisionTick(this.nextDecisionTick(context.tickId));
    }

    return events;
  }

  private enqueueLlmDecision(agent: Agent, context: DecisionContext): void {
    const llmClient = context.llmClient;
    const llmQueue = context.llmQueue;
    if (!llmClient || !llmQueue) {
      return;
    }

    this.pendingLlmByAgent.add(agent.id);

    const nearbyAgents = context.agentManager
      .getAll()
      .filter((candidate) => candidate.id !== agent.id)
      .slice(0, 5)
      .map((candidate) => candidate.name);

    const nearbyLocations = context.town.getAllLocations().slice(0, 8).map((location) => location.name);
    const memories = context.memoryByAgent?.get(agent.id);
    const memorySnippets =
      memories
        ?.retrieveTopK('plan next action', context.gameTime.totalMinutes, 4)
        .map((entry) => entry.memory.content) ?? [];

    const prompt = buildActionPrompt(agent.toFullState(), {
      nearbyAgents,
      nearbyLocations,
      memorySnippets,
      gameTimeText: `day ${context.gameTime.day}, ${context.gameTime.hour}:${String(context.gameTime.minute).padStart(2, '0')}`,
    });

    void llmQueue
      .enqueue({
        id: `decision-${agent.id}-${context.tickId}`,
        priority: 2,
        ttlMs: this.config.llmRequestTtlMs,
        execute: async () => {
          const response = await llmClient.generate({
            prompt,
            format: 'json',
          });

          if (!response.success || !response.content) {
            throw new Error(response.error ?? 'LLM generation failed');
          }

          const parsedJson = JSON.parse(response.content) as unknown;
          return parseActionResponse(parsedJson);
        },
      })
      .then((outcome) => {
        this.pendingLlmByAgent.delete(agent.id);
        this.llmDecisionCount += 1;

        if (outcome.status !== 'ok' || !outcome.value?.success) {
          this.llmFallbackCount += 1;
          this.applyRuleBasedDecision(agent, context.pathfinding, context.walkableWaypoints);

          this.deferredLogs.push({
            type: 'log',
            level: 'warn',
            message: `LLM fallback used for ${agent.name}`,
            agentId: agent.id,
            gameTime: context.gameTime,
          });
          return;
        }

        const action = outcome.value.data;
        if (action.action === 'WAIT') {
          agent.clearPath();
          agent.setCurrentAction('waiting');
          return;
        }

        if (action.action === 'GO_HOME') {
          const home = context.town.getLocation(agent.toFullState().homeLocation)?.spawnPoint;
          if (home) {
            this.assignPath(agent, context.pathfinding, home);
            agent.setCurrentAction('going_home');
            return;
          }
        }

        this.applyRuleBasedDecision(agent, context.pathfinding, context.walkableWaypoints);
      })
      .catch((_error) => {
        this.pendingLlmByAgent.delete(agent.id);
        this.llmDecisionCount += 1;
        this.llmFallbackCount += 1;
        this.applyRuleBasedDecision(agent, context.pathfinding, context.walkableWaypoints);
      });
  }

  private flushDeferredLogs(): LogEvent[] {
    const logs = [...this.deferredLogs];
    this.deferredLogs.length = 0;
    return logs;
  }

  private applyRuleBasedDecision(agent: Agent, pathfinding: Pathfinding, waypoints: TilePosition[]): void {
    const start = agent.getTilePosition();

    const candidates = this.pickWaypoints(waypoints, 6);
    for (const target of candidates) {
      const path = pathfinding.findPath(start, target);
      if (!path || path.length === 0) {
        continue;
      }

      agent.setPath(path);
      return;
    }

    agent.clearPath();
  }

  private assignPath(agent: Agent, pathfinding: Pathfinding, target: TilePosition): void {
    const path = pathfinding.findPath(agent.getTilePosition(), target);
    if (path && path.length > 0) {
      agent.setPath(path);
      return;
    }

    agent.clearPath();
  }

  private nextDecisionTick(currentTick: number): number {
    return currentTick + this.rng.range(this.config.minDecisionIntervalTicks, this.config.maxDecisionIntervalTicks);
  }

  private pickWaypoints(waypoints: TilePosition[], count: number): TilePosition[] {
    if (waypoints.length <= count) {
      return [...waypoints];
    }

    const output: TilePosition[] = [];
    const used = new Set<number>();

    while (output.length < count) {
      const index = this.rng.nextInt(waypoints.length);
      if (used.has(index)) {
        continue;
      }
      used.add(index);
      output.push(waypoints[index]);
    }

    return output;
  }
}
