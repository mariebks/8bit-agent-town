import { LocationId } from '@shared/Types';
import { scoreMemory, tokenize } from './MemoryScoring';
import { Memory, MemoryConfig, MemorySource, MemoryType, ObservationInput, PlanItem, PlanMemory, ScoredMemory } from './Types';

const DEFAULT_CONFIG: MemoryConfig = {
  maxObservations: 200,
  maxReflections: 50,
  maxPlans: 7,
  importanceThreshold: 5,
};

interface SerializedMemoryStream {
  agentId: string;
  sequence: number;
  observations: Memory[];
  reflections: Memory[];
  plans: PlanMemory[];
}

function clampImportance(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export class MemoryStream {
  private readonly agentId: string;
  private readonly config: MemoryConfig;
  private sequence = 0;

  private observations: Memory[] = [];
  private reflections: Memory[] = [];
  private plans: PlanMemory[] = [];

  constructor(agentId: string, config: Partial<MemoryConfig> = {}) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addObservation(input: ObservationInput): Memory {
    const memory: Memory = {
      id: this.nextMemoryId(),
      type: MemoryType.Observation,
      content: input.content,
      timestamp: input.gameTime,
      location: input.location,
      subjects: [...input.subjects],
      keywords: tokenize(input.content),
      importance: clampImportance(input.importance ?? 4),
      accessCount: 0,
      lastAccessed: input.gameTime,
      source: input.source,
      sourceId: input.sourceId,
      isArchived: false,
      confidence: input.confidence,
      hopCount: input.hopCount,
    };

    this.observations.push(memory);
    this.pruneObservations();
    return memory;
  }

  addReflection(content: string, gameTime: number, sourceMemoryIds: string[] = []): Memory {
    const location = this.mostRecentLocation() ?? 'plaza';
    const memory: Memory = {
      id: this.nextMemoryId(),
      type: MemoryType.Reflection,
      content,
      timestamp: gameTime,
      location,
      subjects: sourceMemoryIds,
      keywords: tokenize(content),
      importance: clampImportance(7),
      accessCount: 0,
      lastAccessed: gameTime,
      source: MemorySource.Internal,
      isArchived: false,
    };

    this.reflections.push(memory);
    this.pruneReflections();
    return memory;
  }

  addPlan(planItems: PlanItem[], gameTime: number, validUntil: number): PlanMemory {
    const location = this.mostRecentLocation() ?? 'plaza';
    const memory: PlanMemory = {
      id: this.nextMemoryId(),
      type: MemoryType.Plan,
      content: planItems.map((item) => item.description).join(' | '),
      timestamp: gameTime,
      location,
      subjects: [],
      keywords: tokenize(planItems.map((item) => item.description).join(' ')),
      importance: clampImportance(8),
      accessCount: 0,
      lastAccessed: gameTime,
      source: MemorySource.Internal,
      isArchived: false,
      planItems,
      validUntil,
    };

    this.plans.push(memory);
    this.prunePlans();
    return memory;
  }

  getAll(): Memory[] {
    return [...this.observations, ...this.reflections, ...this.plans];
  }

  getByType(type: MemoryType): Memory[] {
    if (type === MemoryType.Observation) {
      return [...this.observations];
    }
    if (type === MemoryType.Reflection) {
      return [...this.reflections];
    }
    return [...this.plans];
  }

  getByTimeRange(startInclusive: number, endInclusive: number): Memory[] {
    return this.getAll().filter((memory) => memory.timestamp >= startInclusive && memory.timestamp <= endInclusive);
  }

  getCurrentPlan(currentGameTime: number): PlanMemory | null {
    const active = this.plans
      .filter((plan) => !plan.isArchived && plan.validUntil >= currentGameTime)
      .sort((a, b) => b.timestamp - a.timestamp);

    return active[0] ?? null;
  }

  retrieveTopK(query: string, currentGameTime: number, limit = 8, contextTerms: string[] = []): ScoredMemory[] {
    const scored = this.getAll()
      .filter((memory) => !memory.isArchived)
      .map((memory) => {
        const parts = scoreMemory(memory, currentGameTime, query, contextTerms);
        return {
          memory,
          score: parts.score,
          components: {
            recency: parts.recency,
            importance: parts.importance,
            relevance: parts.relevance,
          },
        } satisfies ScoredMemory;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    for (const item of scored) {
      this.markAccessed(item.memory.id, currentGameTime);
    }

    return scored;
  }

  markAccessed(memoryId: string, gameTime: number): void {
    for (const memory of this.getAll()) {
      if (memory.id === memoryId) {
        memory.accessCount += 1;
        memory.lastAccessed = gameTime;
      }
    }
  }

  archive(memoryId: string): void {
    for (const memory of this.getAll()) {
      if (memory.id === memoryId) {
        memory.isArchived = true;
      }
    }
  }

  prune(currentGameTime: number): void {
    // Prefer low-importance archival first for old observations.
    for (const memory of this.observations) {
      const age = currentGameTime - memory.timestamp;
      if (age > 24 * 60 && memory.importance < this.config.importanceThreshold) {
        memory.isArchived = true;
      }
    }

    this.pruneObservations();
    this.pruneReflections();
    this.prunePlans();
  }

  toJSON(): SerializedMemoryStream {
    return {
      agentId: this.agentId,
      sequence: this.sequence,
      observations: this.observations,
      reflections: this.reflections,
      plans: this.plans,
    };
  }

  static fromJSON(data: SerializedMemoryStream, config: Partial<MemoryConfig> = {}): MemoryStream {
    const stream = new MemoryStream(data.agentId, config);
    stream.sequence = data.sequence;
    stream.observations = data.observations;
    stream.reflections = data.reflections;
    stream.plans = data.plans;
    return stream;
  }

  getStats(): {
    observations: number;
    reflections: number;
    plans: number;
    archived: number;
  } {
    const all = this.getAll();
    return {
      observations: this.observations.length,
      reflections: this.reflections.length,
      plans: this.plans.length,
      archived: all.filter((memory) => memory.isArchived).length,
    };
  }

  private pruneObservations(): void {
    if (this.observations.length <= this.config.maxObservations) {
      return;
    }

    this.observations = this.observations
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(this.observations.length - this.config.maxObservations);
  }

  private pruneReflections(): void {
    if (this.reflections.length <= this.config.maxReflections) {
      return;
    }

    this.reflections = this.reflections
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(this.reflections.length - this.config.maxReflections);
  }

  private prunePlans(): void {
    if (this.plans.length <= this.config.maxPlans) {
      return;
    }

    this.plans = this.plans
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(this.plans.length - this.config.maxPlans);
  }

  private mostRecentLocation(): LocationId | null {
    const latest = this.getAll().sort((a, b) => b.timestamp - a.timestamp)[0];
    return latest?.location ?? null;
  }

  private nextMemoryId(): string {
    this.sequence += 1;
    return `${this.agentId}-m${this.sequence}`;
  }
}
