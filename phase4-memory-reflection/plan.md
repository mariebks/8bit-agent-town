# Phase 4: Memory, Reflection, and Planning - Implementation Plan

## Overview

This phase implements persistent agent cognition through memory streams, retrieval scoring, daily planning, periodic reflection, and memory management. These components transform agents from simple rule-followers into entities with coherent, evolving mental states grounded in their experiences.

## Expert corrections (supersedes conflicting details below)

1. Keep cognition work asynchronous and budgeted:
   - Planning, reflection, and summarization must be queued jobs with strict per-tick/per-day budgets.
   - Do not run LLM-heavy cognition inline during tick processing.
2. Start retrieval simple, then iterate:
   - Begin with lightweight keyword + metadata scoring.
   - Treat BM25 indexing as optional optimization after baseline behavior is verified.
3. Reflection cadence should be lower by default:
   - A 4-hour default for every agent is likely too expensive on local hardware.
   - Default to 1-2 reflections per in-game day per agent, with dynamic throttling under load.
4. Memory API consistency is required:
   - Standardize `MemoryStream` write signatures to avoid mixed call shapes in later implementation.
   - Ensure examples use one consistent `addObservation` contract.
5. Pruning/summarization strategy:
   - Prefer cheap heuristic compaction first.
   - Use LLM summarization only for high-value or unusually long conversations.
6. Preserve interview constraint boundaries:
   - Keep runtime memory in-process only.
   - Optional debug snapshots may exist for inspection/replay and must be explicitly non-authoritative.

---

## Objectives

1. **Memory Storage**: Store observations, reflections, and plans with rich metadata
2. **Intelligent Retrieval**: Score and fetch memories by recency, importance, and relevance
3. **Daily Planning**: Generate structured plans each in-game morning that guide agent behavior
4. **Periodic Reflection**: Synthesize higher-level insights from recent experiences
5. **Memory Management**: Summarize and prune to prevent unbounded growth

---

## Prerequisites (from Phases 1-3)

Before implementing Phase 4, the following must be complete:
- `TimeManager` with day boundary events and game time tracking
- `OllamaClient` with request queue and JSON validation
- `PromptTemplates.ts` with base prompt builders
- Agent data model with identity, position, and status
- Shared types in `src/shared/Types.ts`

---

## File Structure

```
src/server/
  memory/
    Types.ts           # Memory type definitions and interfaces
    MemoryStream.ts    # Per-agent memory storage and write APIs
    MemoryScoring.ts   # Scoring functions (recency, importance, relevance)
    Retriever.ts       # Top-K memory retrieval with combined scoring
    Summarizer.ts      # Conversation compression and memory summaries
    Pruner.ts          # Memory cleanup and limit enforcement
  agents/cognition/
    Perceive.ts        # Generate observations from world events
    Retrieve.ts        # Context-aware memory retrieval for prompts
    Reflect.ts         # Periodic reflection generation
    Plan.ts            # Daily and hourly planning logic
    Act.ts             # Action selection using plan + memories
```

---

## Detailed Implementation Tasks

### Task 1: Memory Type Definitions (`src/server/memory/Types.ts`)

**Objective**: Define all memory-related interfaces and enums.

**Implementation**:

```typescript
// Memory type enumeration
export enum MemoryType {
  Observation = 'observation',
  Reflection = 'reflection',
  Plan = 'plan'
}

// Memory source tracking
export enum MemorySource {
  Perception = 'perception',     // Saw something
  Dialogue = 'dialogue',         // Heard in conversation
  Internal = 'internal',         // Self-generated (reflections, plans)
  Social = 'social'              // Told by another agent
}

// Core memory entry
export interface Memory {
  id: string;                    // Unique identifier (uuid)
  type: MemoryType;
  content: string;               // Natural language description
  timestamp: number;             // Game time in total minutes
  createdAt: number;             // Real-world timestamp
  
  // Spatial context
  location: string;              // LocationId where memory formed
  
  // Semantic context
  subjects: string[];            // Agent IDs or entity names involved
  keywords: string[];            // Extracted for keyword-based relevance
  
  // Scoring metadata
  importance: number;            // 1-10 scale (LLM-rated or heuristic)
  accessCount: number;           // Times retrieved (for recency boost)
  lastAccessed: number;          // Game time of last retrieval
  
  // Source tracking
  source: MemorySource;
  sourceId?: string;             // Conversation ID, event ID, etc.
  
  // Relationships
  parentId?: string;             // If derived from another memory
  isArchived: boolean;           // Summarized into another memory
}

// Plan-specific extension
export interface PlanMemory extends Memory {
  type: MemoryType.Plan;
  planItems: PlanItem[];
  validUntil: number;            // Game time when plan expires
}

export interface PlanItem {
  id: string;
  description: string;
  targetLocation?: string;
  targetTime?: number;           // Scheduled game time
  priority: number;              // 1-5 (5 = highest)
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

// Retrieval result
export interface ScoredMemory {
  memory: Memory;
  score: number;
  components: {
    recency: number;
    importance: number;
    relevance: number;
  };
}

// Configuration
export interface MemoryConfig {
  maxObservations: number;       // Rolling window size (default: 200)
  maxReflections: number;        // Keep last N reflections (default: 50)
  maxPlans: number;              // Keep last N daily plans (default: 7)
  importanceThreshold: number;   // Min importance to avoid pruning (default: 5)
  reflectionIntervalHours: number; // In-game hours between reflections (default: 12)
  summaryThreshold: number;      // Messages before summarizing conversation
}
```

**Acceptance Criteria**:
- All interfaces compile without errors
- Types cover all memory scenarios from the Generative Agents paper
- Zod schemas exist for runtime validation of stored memories

---

### Task 2: Memory Stream Storage (`src/server/memory/MemoryStream.ts`)

**Objective**: Implement per-agent memory storage with efficient write and query APIs.

**Implementation Details**:

```typescript
export class MemoryStream {
  private agentId: string;
  private observations: Memory[] = [];
  private reflections: Memory[] = [];
  private plans: PlanMemory[] = [];
  private config: MemoryConfig;
  
  constructor(agentId: string, config?: Partial<MemoryConfig>);
  
  // Write APIs
  addObservation(context: ObservationContext): Memory;
  addReflection(content: string, sourceMemories: string[]): Memory;
  addPlan(planItems: PlanItem[], validUntil: number): PlanMemory;
  
  // Batch operations
  addObservationBatch(observations: ObservationContext[]): Memory[];
  
  // Query APIs
  getAll(): Memory[];
  getByType(type: MemoryType): Memory[];
  getByTimeRange(start: number, end: number): Memory[];
  getBySubject(subjectId: string): Memory[];
  getCurrentPlan(): PlanMemory | null;
  
  // Lifecycle
  markAccessed(memoryId: string, gameTime: number): void;
  archive(memoryId: string): void;
  
  // Serialization
  toJSON(): SerializedMemoryStream;
  static fromJSON(data: SerializedMemoryStream): MemoryStream;
  
  // Statistics
  getStats(): MemoryStats;
}

interface ObservationContext {
  content: string;
  gameTime: number;
  location: string;
  subjects: string[];
  source: MemorySource;
  importance?: number;  // If not provided, will be scored later
}
```

**Key Design Decisions**:
1. **Separate arrays by type**: Enables efficient type-specific queries and pruning
2. **Lazy importance scoring**: Observations can be added with placeholder importance, scored in batches via LLM
3. **Access tracking**: `accessCount` and `lastAccessed` support recency boosting for frequently-used memories
4. **Archive flag**: Soft-delete for summarized memories (preserves references)

**Acceptance Criteria**:
- Can store 1000+ memories without performance degradation
- All CRUD operations complete in <1ms
- JSON serialization round-trips perfectly
- Memory IDs are unique across the stream

---

### Task 3: Recency Scoring (`src/server/memory/MemoryScoring.ts`)

**Objective**: Implement exponential decay scoring based on in-game time.

**Implementation**:

```typescript
/**
 * Recency score with exponential decay
 * Returns value between 0 and 1
 * 
 * @param memoryTime - Game time when memory was created (total minutes)
 * @param currentTime - Current game time (total minutes)
 * @param halfLife - Minutes for score to decay to 0.5 (default: 360 = 6 hours)
 */
export function calculateRecency(
  memoryTime: number,
  currentTime: number,
  halfLife: number = 360
): number {
  const ageMinutes = currentTime - memoryTime;
  if (ageMinutes <= 0) return 1;
  
  // Exponential decay: score = 0.5^(age/halfLife)
  return Math.pow(0.5, ageMinutes / halfLife);
}

/**
 * Normalize importance from 1-10 scale to 0-1
 */
export function normalizeImportance(importance: number): number {
  return Math.max(0, Math.min(1, (importance - 1) / 9));
}
```

**Decay Curve Parameters**:
| Half-Life (game hours) | Use Case |
|------------------------|----------|
| 6 hours | Standard observations |
| 24 hours | Important events |
| 72 hours | Reflections |

---

### Task 4: Importance Scoring (`src/server/memory/MemoryScoring.ts`)

**Objective**: Rate memory importance using LLM with heuristic fallback.

**Implementation**:

```typescript
/**
 * LLM-based importance scoring
 * Batches multiple memories for efficiency
 */
export async function scoreImportanceBatch(
  memories: Memory[],
  llmClient: OllamaClient
): Promise<Map<string, number>> {
  const prompt = buildImportancePrompt(memories);
  
  try {
    const response = await llmClient.generate({
      prompt,
      format: 'json',
      timeout: 10000
    });
    
    const scores = ImportanceResponseSchema.parse(response);
    return new Map(scores.ratings.map(r => [r.id, r.score]));
  } catch (error) {
    // Fallback to heuristics
    return heuristicImportanceScoring(memories);
  }
}

/**
 * Heuristic importance when LLM unavailable
 */
export function heuristicImportanceScoring(memories: Memory[]): Map<string, number> {
  const scores = new Map<string, number>();
  
  for (const memory of memories) {
    let score = 5; // Base score
    
    // Type-based adjustments
    if (memory.type === MemoryType.Reflection) score += 2;
    if (memory.type === MemoryType.Plan) score += 1;
    
    // Content-based heuristics
    const content = memory.content.toLowerCase();
    if (content.includes('important') || content.includes('significant')) score += 1;
    if (content.includes('relationship') || content.includes('friend')) score += 1;
    if (content.includes('learned') || content.includes('realized')) score += 1;
    if (memory.subjects.length > 2) score += 1; // Multi-agent events
    
    // Source-based adjustments
    if (memory.source === MemorySource.Dialogue) score += 1;
    
    scores.set(memory.id, Math.min(10, Math.max(1, score)));
  }
  
  return scores;
}
```

**Importance Prompt Template**:
```
Rate the importance of each memory on a scale of 1-10.
1 = mundane, forgettable (e.g., "walked past a tree")
10 = life-changing, unforgettable (e.g., "got married", "discovered a secret")

Memories:
{{#each memories}}
[{{id}}] {{content}}
{{/each}}

Return JSON: { "ratings": [{ "id": "...", "score": N }, ...] }
```

---

### Task 5: Lightweight Keyword Relevance (`src/server/memory/MemoryScoring.ts`)

**Objective**: Calculate fast relevance without embeddings and without heavyweight indexing.

**Implementation**:

```typescript
/**
 * Extract normalized keywords from free text.
 */
export function extractKeywords(content: string): string[] {
  const stopWords = new Set(['a', 'an', 'the', 'is', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'or', 'if', 'i']);

  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Jaccard-style overlap relevance in [0, 1].
 * Good baseline for local hardware; BM25 can be added later if needed.
 */
export function keywordRelevance(memoryKeywords: string[], queryTerms: string[]): number {
  if (memoryKeywords.length === 0 || queryTerms.length === 0) return 0;

  const memorySet = new Set(memoryKeywords.map(k => k.toLowerCase()));
  const querySet = new Set(queryTerms.map(t => t.toLowerCase()));

  let intersection = 0;
  for (const q of querySet) {
    if (memorySet.has(q)) intersection++;
  }

  const union = new Set([...memorySet, ...querySet]).size;
  return union > 0 ? intersection / union : 0;
}
```

---

### Task 6: Combined Retrieval (`src/server/memory/Retriever.ts`)

**Objective**: Fetch top-K memories using weighted scoring.

**Implementation**:

```typescript
export interface RetrievalQuery {
  queryTerms: string[];          // For relevance scoring
  currentTime: number;           // Game time for recency
  limit: number;                 // K memories to return
  typeFilter?: MemoryType[];     // Optional type restriction
  subjectFilter?: string[];      // Optional subject restriction
  minImportance?: number;        // Importance floor
}

export interface RetrievalWeights {
  recency: number;    // Default: 0.5
  importance: number; // Default: 0.3
  relevance: number;  // Default: 0.2
}

export class MemoryRetriever {
  private weights: RetrievalWeights;
  
  constructor(weights?: Partial<RetrievalWeights>) {
    this.weights = {
      recency: 0.5,
      importance: 0.3,
      relevance: 0.2,
      ...weights
    };
  }
  
  /**
   * Retrieve top-K memories for the given query
   */
  retrieve(
    stream: MemoryStream,
    query: RetrievalQuery
  ): ScoredMemory[] {
    let memories = stream.getAll();
    
    // Apply filters
    if (query.typeFilter) {
      memories = memories.filter(m => query.typeFilter!.includes(m.type));
    }
    if (query.subjectFilter) {
      memories = memories.filter(m => 
        m.subjects.some(s => query.subjectFilter!.includes(s))
      );
    }
    if (query.minImportance) {
      memories = memories.filter(m => m.importance >= query.minImportance!);
    }
    
    // Score all memories
    const scored: ScoredMemory[] = memories.map(memory => {
      const recency = calculateRecency(memory.timestamp, query.currentTime);
      const importance = normalizeImportance(memory.importance);
      const relevance = keywordRelevance(memory.keywords, query.queryTerms);
      
      const score = 
        this.weights.recency * recency +
        this.weights.importance * importance +
        this.weights.relevance * relevance;
      
      return {
        memory,
        score,
        components: { recency, importance, relevance }
      };
    });
    
    // Sort by score descending and take top K
    scored.sort((a, b) => b.score - a.score);
    
    // Mark accessed memories
    const topK = scored.slice(0, query.limit);
    for (const sm of topK) {
      stream.markAccessed(sm.memory.id, query.currentTime);
    }
    
    return topK;
  }
  
  /**
   * Convenience method for action selection context
   */
  retrieveForContext(
    stream: MemoryStream,
    situation: string,
    currentTime: number,
    limit: number = 10
  ): ScoredMemory[] {
    const queryTerms = extractKeywords(situation);
    return this.retrieve(stream, {
      queryTerms,
      currentTime,
      limit
    });
  }
}
```

**Acceptance Criteria**:
- Retrieval returns exactly K memories (or all if fewer exist)
- Score breakdown is accurate and components sum correctly with weights
- Performance: <10ms for 200 memories

---

### Task 7: Daily Planning (`src/server/agents/cognition/Plan.ts`)

**Objective**: Generate structured daily plans at morning boundaries.

**Implementation**:

```typescript
export class PlanningSystem {
  private llmClient: OllamaClient;
  private retriever: MemoryRetriever;
  
  constructor(llmClient: OllamaClient, retriever: MemoryRetriever) {
    this.llmClient = llmClient;
    this.retriever = retriever;
  }
  
  /**
   * Generate daily plan for an agent
   * Called at morning boundary (e.g., 6:00 AM game time)
   */
  async generateDailyPlan(
    agent: Agent,
    gameTime: GameTime,
    locations: LocationData[]
  ): Promise<PlanMemory> {
    // Retrieve relevant memories for planning context
    const recentMemories = this.retriever.retrieve(agent.memory, {
      queryTerms: ['plan', 'today', 'tomorrow', 'want', 'need', 'goal'],
      currentTime: gameTime.totalMinutes,
      limit: 15,
      typeFilter: [MemoryType.Observation, MemoryType.Reflection]
    });
    
    // Get yesterday's plan for continuity
    const previousPlan = agent.memory.getCurrentPlan();
    
    // Build planning prompt
    const prompt = buildDailyPlanPrompt({
      agent: agent.profile,
      currentTime: gameTime,
      memories: recentMemories.map(sm => sm.memory),
      previousPlan: previousPlan?.planItems.filter(p => p.status !== 'completed'),
      availableLocations: locations,
      statusMeters: agent.status
    });
    
    try {
      const response = await this.llmClient.generate({
        prompt,
        format: 'json',
        timeout: 15000
      });
      
      const planData = DailyPlanResponseSchema.parse(response);
      
      // Convert to PlanItems
      const planItems: PlanItem[] = planData.activities.map((activity, idx) => ({
        id: `plan-${agent.id}-${gameTime.day}-${idx}`,
        description: activity.description,
        targetLocation: activity.location,
        targetTime: this.parseTimeToMinutes(activity.time, gameTime.day),
        priority: activity.priority || 3,
        status: 'pending' as const
      }));
      
      // Store plan in memory
      const planMemory = agent.memory.addPlan(
        planItems,
        (gameTime.day + 1) * 24 * 60 // Valid until next morning
      );
      
      return planMemory;
      
    } catch (error) {
      // Fallback: generate rule-based plan
      return this.generateFallbackPlan(agent, gameTime, locations);
    }
  }
  
  /**
   * Rule-based fallback plan
   */
  private generateFallbackPlan(
    agent: Agent,
    gameTime: GameTime,
    locations: LocationData[]
  ): PlanMemory {
    const planItems: PlanItem[] = [
      {
        id: `plan-${agent.id}-${gameTime.day}-0`,
        description: 'Have breakfast at home',
        targetLocation: agent.profile.homeLocation,
        targetTime: gameTime.day * 24 * 60 + 7 * 60, // 7 AM
        priority: 4,
        status: 'pending'
      },
      {
        id: `plan-${agent.id}-${gameTime.day}-1`,
        description: `Go to work at ${agent.profile.workLocation}`,
        targetLocation: agent.profile.workLocation,
        targetTime: gameTime.day * 24 * 60 + 9 * 60, // 9 AM
        priority: 5,
        status: 'pending'
      },
      {
        id: `plan-${agent.id}-${gameTime.day}-2`,
        description: 'Have lunch',
        targetLocation: this.findLocationByType(locations, 'restaurant') || agent.profile.homeLocation,
        targetTime: gameTime.day * 24 * 60 + 12 * 60, // 12 PM
        priority: 4,
        status: 'pending'
      },
      {
        id: `plan-${agent.id}-${gameTime.day}-3`,
        description: 'Continue working',
        targetLocation: agent.profile.workLocation,
        targetTime: gameTime.day * 24 * 60 + 13 * 60, // 1 PM
        priority: 5,
        status: 'pending'
      },
      {
        id: `plan-${agent.id}-${gameTime.day}-4`,
        description: 'Relax and socialize',
        targetLocation: this.findLocationByTag(locations, 'social') || 'plaza',
        targetTime: gameTime.day * 24 * 60 + 17 * 60, // 5 PM
        priority: 3,
        status: 'pending'
      },
      {
        id: `plan-${agent.id}-${gameTime.day}-5`,
        description: 'Return home for dinner and rest',
        targetLocation: agent.profile.homeLocation,
        targetTime: gameTime.day * 24 * 60 + 20 * 60, // 8 PM
        priority: 4,
        status: 'pending'
      }
    ];
    
    return agent.memory.addPlan(
      planItems,
      (gameTime.day + 1) * 24 * 60
    );
  }
  
  /**
   * Update plan item status
   */
  updatePlanStatus(
    agent: Agent,
    planItemId: string,
    status: 'active' | 'completed' | 'cancelled'
  ): void {
    const plan = agent.memory.getCurrentPlan();
    if (!plan) return;
    
    const item = plan.planItems.find(p => p.id === planItemId);
    if (item) {
      item.status = status;
    }
  }
  
  /**
   * Get next pending plan item
   */
  getNextPlanItem(agent: Agent, currentTime: number): PlanItem | null {
    const plan = agent.memory.getCurrentPlan();
    if (!plan || plan.validUntil < currentTime) return null;
    
    // Find first pending item whose time has come
    return plan.planItems
      .filter(p => p.status === 'pending')
      .sort((a, b) => (a.targetTime || 0) - (b.targetTime || 0))
      .find(p => !p.targetTime || p.targetTime <= currentTime) || null;
  }
}
```

**Daily Plan Prompt Template**:
```
You are {{agent.name}}, a {{agent.age}}-year-old {{agent.occupation}}.

Your traits: {{agent.traits}}
Current status: Energy {{status.energy}}%, Hunger {{status.hunger}}%, Mood {{status.mood}}%

Today is Day {{day}}, {{dayOfWeek}}. The time is {{time}}.

Recent memories that might affect your plans:
{{#each memories}}
- {{content}}
{{/each}}

{{#if unfinishedTasks}}
Unfinished from yesterday:
{{#each unfinishedTasks}}
- {{description}}
{{/each}}
{{/if}}

Available locations: {{locations}}

Create a realistic daily plan with 5-8 activities. Consider your occupation, personality, and recent experiences.

Return JSON:
{
  "activities": [
    { "time": "7:00 AM", "description": "...", "location": "...", "priority": 1-5 },
    ...
  ]
}
```

---

### Task 8: Reflection System (`src/server/agents/cognition/Reflect.ts`)

**Objective**: Generate periodic insights that synthesize recent experiences.

**Implementation**:

```typescript
export class ReflectionSystem {
  private llmClient: OllamaClient;
  private retriever: MemoryRetriever;
  private reflectionInterval: number; // Game hours
  
  constructor(
    llmClient: OllamaClient,
    retriever: MemoryRetriever,
    intervalHours: number = 12
  ) {
    this.llmClient = llmClient;
    this.retriever = retriever;
    this.reflectionInterval = intervalHours;
  }
  
  /**
   * Check if reflection is due
   */
  shouldReflect(agent: Agent, currentTime: number): boolean {
    const lastReflection = agent.memory
      .getByType(MemoryType.Reflection)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (!lastReflection) return true;
    
    const hoursSince = (currentTime - lastReflection.timestamp) / 60;
    return hoursSince >= this.reflectionInterval;
  }
  
  /**
   * Generate a reflection based on recent memories
   */
  async generateReflection(
    agent: Agent,
    gameTime: GameTime
  ): Promise<Memory> {
    // Get recent observations since last reflection
    const lastReflection = agent.memory
      .getByType(MemoryType.Reflection)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const sinceTime = lastReflection?.timestamp || 0;
    
    const recentMemories = agent.memory
      .getByTimeRange(sinceTime, gameTime.totalMinutes)
      .filter(m => m.type === MemoryType.Observation)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20);
    
    if (recentMemories.length < 3) {
      // Not enough to reflect on
      return this.generateMinimalReflection(agent, gameTime);
    }
    
    const prompt = buildReflectionPrompt({
      agent: agent.profile,
      currentTime: gameTime,
      recentMemories
    });
    
    try {
      const response = await this.llmClient.generate({
        prompt,
        format: 'json',
        timeout: 12000
      });
      
      const reflectionData = ReflectionResponseSchema.parse(response);
      
      // Store reflection with high importance
      const reflection = agent.memory.addReflection(
        reflectionData.insight,
        recentMemories.map(m => m.id) // Link to source memories
      );
      
      // Override importance to ensure reflections persist
      reflection.importance = Math.max(7, reflectionData.significance || 7);
      
      // Apply relationship effects if specified
      if (reflectionData.relationshipChanges) {
        this.applyRelationshipChanges(agent, reflectionData.relationshipChanges);
      }
      
      return reflection;
      
    } catch (error) {
      return this.generateFallbackReflection(agent, recentMemories, gameTime);
    }
  }
  
  /**
   * Fallback reflection without LLM
   */
  private generateFallbackReflection(
    agent: Agent,
    memories: Memory[],
    gameTime: GameTime
  ): Memory {
    // Simple summarization
    const subjects = new Set<string>();
    const locations = new Set<string>();
    
    for (const m of memories) {
      m.subjects.forEach(s => subjects.add(s));
      locations.add(m.location);
    }
    
    let insight = `Today I spent time at ${Array.from(locations).join(', ')}.`;
    
    if (subjects.size > 0) {
      const otherAgents = Array.from(subjects).filter(s => s !== agent.id);
      if (otherAgents.length > 0) {
        insight += ` I interacted with ${otherAgents.join(', ')}.`;
      }
    }
    
    const reflection = agent.memory.addReflection(insight, memories.map(m => m.id));
    reflection.importance = 6; // Moderate importance for fallback
    
    return reflection;
  }
  
  /**
   * Minimal reflection when not enough observations
   */
  private generateMinimalReflection(
    agent: Agent,
    gameTime: GameTime
  ): Memory {
    const insight = `It's been a quiet period. Nothing particularly notable has happened.`;
    const reflection = agent.memory.addReflection(insight, []);
    reflection.importance = 4; // Low importance
    return reflection;
  }
}
```

**Reflection Prompt Template**:
```
You are {{agent.name}}, reflecting on recent experiences.

Your traits: {{agent.traits}}

Recent observations (most important first):
{{#each memories}}
- [{{formatTime timestamp}}] {{content}}
{{/each}}

Based on these experiences, generate ONE meaningful insight or reflection.
Consider:
- What patterns do you notice?
- Have your relationships changed?
- What have you learned?
- How do you feel about recent events?

Return JSON:
{
  "insight": "A single paragraph reflection",
  "significance": 1-10,
  "relationshipChanges": [
    { "agentId": "...", "change": -2 to +2, "reason": "..." }
  ] // optional
}
```

---

### Task 9: Memory Summarization (`src/server/memory/Summarizer.ts`)

**Objective**: Compress conversations and old observations.

**Implementation**:

```typescript
export class MemorySummarizer {
  private llmClient: OllamaClient;
  
  constructor(llmClient: OllamaClient) {
    this.llmClient = llmClient;
  }
  
  /**
   * Summarize a conversation into a single memory
   */
  async summarizeConversation(
    agent: Agent,
    conversationMemories: Memory[]
  ): Promise<Memory> {
    if (conversationMemories.length === 0) {
      throw new Error('No memories to summarize');
    }
    
    const sortedMemories = conversationMemories
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const firstMemory = sortedMemories[0];
    const lastMemory = sortedMemories[sortedMemories.length - 1];
    
    const participants = new Set<string>();
    conversationMemories.forEach(m => m.subjects.forEach(s => participants.add(s)));
    
    const prompt = buildSummaryPrompt({
      agentName: agent.profile.name,
      participants: Array.from(participants),
      messages: conversationMemories.map(m => m.content)
    });
    
    try {
      const response = await this.llmClient.generate({
        prompt,
        format: 'json',
        timeout: 10000
      });
      
      const summaryData = SummaryResponseSchema.parse(response);
      
      // Create summary memory
      const summary = agent.memory.addObservation({
        content: summaryData.summary,
        gameTime: lastMemory.timestamp,
        location: firstMemory.location,
        subjects: Array.from(participants),
        source: MemorySource.Dialogue,
        importance: Math.max(...conversationMemories.map(m => m.importance))
      });
      
      // Archive original memories
      for (const mem of conversationMemories) {
        agent.memory.archive(mem.id);
      }
      
      return summary;
      
    } catch (error) {
      // Fallback: simple concatenation
      return this.fallbackSummarize(agent, conversationMemories);
    }
  }
  
  /**
   * Summarize a batch of low-importance observations
   */
  async summarizeObservationBatch(
    agent: Agent,
    observations: Memory[]
  ): Promise<Memory> {
    const byLocation = new Map<string, Memory[]>();
    
    for (const obs of observations) {
      const existing = byLocation.get(obs.location) || [];
      existing.push(obs);
      byLocation.set(obs.location, existing);
    }
    
    const summaryParts: string[] = [];
    
    for (const [location, mems] of byLocation) {
      if (mems.length === 1) {
        summaryParts.push(`At ${location}: ${mems[0].content}`);
      } else {
        summaryParts.push(`At ${location}: ${mems.length} routine events occurred.`);
      }
    }
    
    const summary = agent.memory.addObservation({
      content: summaryParts.join(' '),
      gameTime: observations[observations.length - 1].timestamp,
      location: observations[0].location,
      subjects: [...new Set(observations.flatMap(o => o.subjects))],
      source: MemorySource.Internal,
      importance: 3 // Summaries of mundane events are low importance
    });
    
    for (const obs of observations) {
      agent.memory.archive(obs.id);
    }
    
    return summary;
  }
  
  private fallbackSummarize(agent: Agent, memories: Memory[]): Memory {
    const participants = [...new Set(memories.flatMap(m => m.subjects))];
    const content = `Had a conversation with ${participants.filter(p => p !== agent.id).join(', ')}. Topics discussed included various matters.`;
    
    const summary = agent.memory.addObservation({
      content,
      gameTime: memories[memories.length - 1].timestamp,
      location: memories[0].location,
      subjects: participants,
      source: MemorySource.Dialogue,
      importance: 5
    });
    
    for (const mem of memories) {
      agent.memory.archive(mem.id);
    }
    
    return summary;
  }
}
```

---

### Task 10: Memory Pruning (`src/server/memory/Pruner.ts`)

**Objective**: Enforce memory limits while preserving important memories.

**Implementation**:

```typescript
export class MemoryPruner {
  private summarizer: MemorySummarizer;
  private config: MemoryConfig;
  
  constructor(summarizer: MemorySummarizer, config: MemoryConfig) {
    this.summarizer = summarizer;
    this.config = config;
  }
  
  /**
   * Run pruning cycle for an agent
   * Returns number of memories removed/archived
   */
  async prune(agent: Agent, currentTime: number): Promise<PruneResult> {
    const result: PruneResult = {
      observationsRemoved: 0,
      reflectionsRemoved: 0,
      conversationsSummarized: 0
    };
    
    // 1. Prune observations beyond limit
    const observations = agent.memory
      .getByType(MemoryType.Observation)
      .filter(m => !m.isArchived);
    
    if (observations.length > this.config.maxObservations) {
      const toRemove = observations.length - this.config.maxObservations;
      
      // Sort by combined score (importance + recency)
      const scored = observations.map(m => ({
        memory: m,
        score: m.importance * 0.7 + calculateRecency(m.timestamp, currentTime) * 10 * 0.3
      })).sort((a, b) => a.score - b.score);
      
      // Remove lowest scoring, but never remove high-importance
      for (let i = 0; i < toRemove && i < scored.length; i++) {
        const item = scored[i];
        if (item.memory.importance < this.config.importanceThreshold) {
          agent.memory.archive(item.memory.id);
          result.observationsRemoved++;
        }
      }
    }
    
    // 2. Summarize old conversations
    const dialogueMemories = observations
      .filter(m => m.source === MemorySource.Dialogue && !m.isArchived);
    
    const conversationGroups = this.groupByConversation(dialogueMemories);
    
    for (const group of conversationGroups) {
      if (group.length >= this.config.summaryThreshold) {
        const oldest = Math.min(...group.map(m => m.timestamp));
        const ageHours = (currentTime - oldest) / 60;
        
        // Summarize only older high-volume/high-value conversations
        const avgImportance = group.reduce((sum, m) => sum + m.importance, 0) / group.length;
        if (ageHours > 24 && (group.length >= this.config.summaryThreshold * 2 || avgImportance >= 6)) {
          await this.summarizer.summarizeConversation(agent, group);
          result.conversationsSummarized++;
        }
      }
    }
    
    // 3. Prune reflections beyond limit
    const reflections = agent.memory
      .getByType(MemoryType.Reflection)
      .filter(m => !m.isArchived)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (reflections.length > this.config.maxReflections) {
      const toRemove = reflections.slice(this.config.maxReflections);
      for (const ref of toRemove) {
        agent.memory.archive(ref.id);
        result.reflectionsRemoved++;
      }
    }
    
    // 4. Prune old plans
    const plans = agent.memory
      .getByType(MemoryType.Plan)
      .filter(m => !m.isArchived)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (plans.length > this.config.maxPlans) {
      const toRemove = plans.slice(this.config.maxPlans);
      for (const plan of toRemove) {
        agent.memory.archive(plan.id);
      }
    }
    
    return result;
  }
  
  /**
   * Group dialogue memories by conversation (same participants, close in time)
   */
  private groupByConversation(memories: Memory[]): Memory[][] {
    const groups: Memory[][] = [];
    const used = new Set<string>();
    
    for (const mem of memories) {
      if (used.has(mem.id)) continue;
      
      const group = [mem];
      used.add(mem.id);
      
      // Find related memories
      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        // Same participants
        const sameParticipants = mem.subjects.length === other.subjects.length &&
          mem.subjects.every(s => other.subjects.includes(s));
        
        // Close in time (within 30 game minutes)
        const closeInTime = Math.abs(mem.timestamp - other.timestamp) < 30;
        
        if (sameParticipants && closeInTime) {
          group.push(other);
          used.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
}

interface PruneResult {
  observationsRemoved: number;
  reflectionsRemoved: number;
  conversationsSummarized: number;
}
```

---

### Task 11: Perception Integration (`src/server/agents/cognition/Perceive.ts`)

**Objective**: Generate observations from world events.

**Implementation**:

```typescript
export class PerceptionSystem {
  private perceptionRadius: number = 5; // Tiles
  private cooldowns: Map<string, number> = new Map(); // Prevent spam
  
  /**
   * Process world state and generate observations for an agent
   */
  perceive(
    agent: Agent,
    worldState: {
      agents: Agent[];
      locations: LocationData[];
    },
    gameTime: number
  ): Memory[] {
    const newMemories: Memory[] = [];
    const agentPos = agent.tilePosition;
    
    // Perceive nearby agents
    for (const other of worldState.agents) {
      if (other.id === agent.id) continue;
      
      const distance = this.tileDistance(agentPos, other.tilePosition);
      if (distance > this.perceptionRadius) continue;
      
      // Check cooldown
      const cooldownKey = `agent:${other.id}`;
      const lastSeen = this.cooldowns.get(cooldownKey) || 0;
      if (gameTime - lastSeen < 10) continue; // 10 game minutes cooldown
      
      this.cooldowns.set(cooldownKey, gameTime);
      
      // Generate observation based on other agent's state
      const observation = this.generateAgentObservation(agent, other, gameTime);
      if (observation) {
        newMemories.push(
          agent.memory.addObservation(observation)
        );
      }
    }
    
    // Perceive location entry
    const currentLocation = this.findLocationAt(agentPos, worldState.locations);
    if (currentLocation) {
      const locationKey = `location:${currentLocation.id}`;
      const lastVisit = this.cooldowns.get(locationKey) || 0;
      
      if (gameTime - lastVisit > 60) { // Only note location every hour
        this.cooldowns.set(locationKey, gameTime);
        
        newMemories.push(
          agent.memory.addObservation({
            content: `Arrived at ${currentLocation.name}.`,
            gameTime,
            location: currentLocation.id,
            subjects: [agent.id],
            source: MemorySource.Perception,
            importance: 2 // Low importance for routine location changes
          })
        );
      }
    }
    
    return newMemories;
  }
  
  private generateAgentObservation(
    observer: Agent,
    observed: Agent,
    gameTime: number
  ): ObservationContext | null {
    const stateDescriptions: Record<string, string> = {
      idle: 'standing around',
      walking: 'walking by',
      conversing: 'having a conversation',
      activity: `engaged in an activity`,
      sleeping: 'resting'
    };
    
    const description = stateDescriptions[observed.state] || 'nearby';
    
    return {
      content: `Saw ${observed.profile.name} ${description}.`,
      gameTime,
      location: observer.currentLocation,
      subjects: [observer.id, observed.id],
      source: MemorySource.Perception,
      importance: observed.state === 'conversing' ? 4 : 2
    };
  }
  
  private tileDistance(a: TilePosition, b: TilePosition): number {
    return Math.abs(a.tileX - b.tileX) + Math.abs(a.tileY - b.tileY);
  }
  
  private findLocationAt(
    pos: TilePosition,
    locations: LocationData[]
  ): LocationData | null {
    for (const loc of locations) {
      if (
        pos.tileX >= loc.bounds.x &&
        pos.tileX < loc.bounds.x + loc.bounds.width &&
        pos.tileY >= loc.bounds.y &&
        pos.tileY < loc.bounds.y + loc.bounds.height
      ) {
        return loc;
      }
    }
    return null;
  }
}
```

---

### Task 12: Action Integration (`src/server/agents/cognition/Act.ts`)

**Objective**: Use memories and plans in action selection.

**Implementation**:

```typescript
export class ActionSystem {
  private llmClient: OllamaClient;
  private retriever: MemoryRetriever;
  private planningSystem: PlanningSystem;
  
  constructor(
    llmClient: OllamaClient,
    retriever: MemoryRetriever,
    planningSystem: PlanningSystem
  ) {
    this.llmClient = llmClient;
    this.retriever = retriever;
    this.planningSystem = planningSystem;
  }
  
  /**
   * Select next action for an agent
   * Integrates plan queue and retrieved memories
   */
  async selectAction(
    agent: Agent,
    worldContext: WorldContext,
    gameTime: GameTime
  ): Promise<AgentAction> {
    // 1. Check for active plan item
    const nextPlanItem = this.planningSystem.getNextPlanItem(
      agent,
      gameTime.totalMinutes
    );
    
    // 2. Build situation description
    const situation = this.describeSituation(agent, worldContext, nextPlanItem);
    
    // 3. Retrieve relevant memories
    const memories = this.retriever.retrieveForContext(
      agent.memory,
      situation,
      gameTime.totalMinutes,
      8
    );
    
    // 4. Check if rule-based action is sufficient
    const ruleBasedAction = this.tryRuleBasedAction(
      agent,
      nextPlanItem,
      worldContext,
      gameTime
    );
    
    if (ruleBasedAction) {
      return ruleBasedAction;
    }
    
    // 5. LLM action selection
    const prompt = buildActionPrompt({
      agent: agent.profile,
      status: agent.status,
      currentPlan: nextPlanItem,
      memories: memories.map(sm => sm.memory),
      situation,
      availableActions: this.getAvailableActions(agent, worldContext)
    });
    
    try {
      const response = await this.llmClient.generate({
        prompt,
        format: 'json',
        timeout: 10000
      });
      
      const actionData = ActionResponseSchema.parse(response);
      
      // Update plan status if completing a plan item
      if (nextPlanItem && actionData.completingPlanItem) {
        this.planningSystem.updatePlanStatus(agent, nextPlanItem.id, 'completed');
      }
      
      return this.parseAction(actionData, agent, worldContext);
      
    } catch (error) {
      // Fallback to rule-based
      return this.fallbackAction(agent, worldContext);
    }
  }
  
  /**
   * Rule-based action when LLM not needed
   */
  private tryRuleBasedAction(
    agent: Agent,
    planItem: PlanItem | null,
    context: WorldContext,
    gameTime: GameTime
  ): AgentAction | null {
    // Critical status needs
    if (agent.status.energy < 20) {
      return { type: 'MOVE_TO', target: agent.profile.homeLocation, reason: 'Need rest' };
    }
    if (agent.status.hunger < 20) {
      const restaurant = context.locations.find(l => l.type === 'restaurant');
      return { type: 'MOVE_TO', target: restaurant?.id || agent.profile.homeLocation, reason: 'Need food' };
    }
    
    // Follow plan if specified
    if (planItem && planItem.targetLocation && agent.currentLocation !== planItem.targetLocation) {
      return { type: 'MOVE_TO', target: planItem.targetLocation, reason: planItem.description };
    }
    
    // Night time sleep
    if (gameTime.hour >= 22 || gameTime.hour < 6) {
      if (agent.currentLocation !== agent.profile.homeLocation) {
        return { type: 'MOVE_TO', target: agent.profile.homeLocation, reason: 'Time to sleep' };
      }
      return { type: 'SLEEP', reason: 'Night time' };
    }
    
    return null; // Needs LLM decision
  }
  
  private fallbackAction(agent: Agent, context: WorldContext): AgentAction {
    // Default: idle or wander
    return { type: 'IDLE', reason: 'Deciding what to do' };
  }
}
```

---

## Integration Points

### TimeManager Hooks

Add to existing `TimeManager`:

```typescript
// In TimeManager.ts
interface TimeHooks {
  onDayBoundary: (day: number) => void;
  onHourBoundary: (hour: number) => void;
}

// Register hooks for planning and reflection
timeManager.on('dayBoundary', (day) => {
  for (const agent of agents) {
    cognitionJobQueue.enqueue({
      type: 'dailyPlan',
      agentId: agent.id,
      day,
      priority: 'high'
    });
  }
});

timeManager.on('hourBoundary', (hour) => {
  for (const agent of agents) {
    if (reflectionSystem.shouldReflect(agent, gameTime.totalMinutes)) {
      cognitionJobQueue.enqueue({
        type: 'reflection',
        agentId: agent.id,
        hour,
        priority: 'normal'
      });
    }
  }
});
```

### Simulation Loop Integration

```typescript
// In Simulation.ts tick loop
processTick() {
  // ... existing tick logic ...
  
  // Perception phase
  for (const agent of this.agents) {
    perceptionSystem.perceive(agent, worldState, this.gameTime.totalMinutes);
  }
  
  // Decision phase (staggered, non-blocking)
  for (const agent of this.agentsDueForDecision()) {
    actionSystem
      .selectAction(agent, worldContext, this.gameTime)
      .then(action => this.enqueueDeferredAction(agent.id, action))
      .catch(() => this.enqueueDeferredAction(agent.id, this.fallbackAction(agent)));
  }
  
  // Apply completed deferred actions at deterministic tick boundary
  this.applyDeferredActionsForTick(this.tickCount);

  // Maintenance budget (every 100 ticks = ~20 seconds)
  if (this.tickCount % 100 === 0) {
    maintenanceQueue.enqueueBatch(
      this.agents.map(agent => ({ type: 'prune', agentId: agent.id }))
    );
  }
}
```

---

## Testing Strategy

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| MemoryStream | Add/retrieve by type, time range filter, serialization round-trip |
| MemoryScoring | Recency decay curve validation, keyword-overlap relevance checks, combined score weights |
| Retriever | Top-K returns correct count, filtering works, access tracking updates |
| Pruner | Respects importance threshold, summarizes conversations, enforces limits |

### Integration Tests

1. **Planning Cycle**: Verify daily plan generation at 6 AM boundary
2. **Reflection Cycle**: Confirm reflections appear every N hours
3. **Memory Growth**: Run 3-day simulation, verify counts stay under limits
4. **Action Selection**: Confirm actions reference plan items and memories

### Manual Test Checklist

- [ ] Agent generates plan on first morning
- [ ] Plan items appear in inspector panel
- [ ] Reflections appear in memory stream
- [ ] Memory count stays under 200 observations
- [ ] Only high-value/long conversations use LLM summarization; routine events use heuristic compaction
- [ ] Action selection uses plan context
- [ ] Fallback works when LLM times out

---

## Configuration Defaults

```typescript
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxObservations: 200,
  maxReflections: 50,
  maxPlans: 7,
  importanceThreshold: 5,
  reflectionIntervalHours: 12,
  summaryThreshold: 5
};

export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalWeights = {
  recency: 0.5,
  importance: 0.3,
  relevance: 0.2
};

export const RECENCY_HALF_LIFE = {
  observation: 360,   // 6 game hours
  reflection: 1440,   // 24 game hours
  plan: 720          // 12 game hours
};
```

---

## Success Criteria

1. **Daily Planning**: Every agent generates a plan at morning boundary with 5-8 items
2. **Plan Reference**: Action selection prompts include current plan item
3. **Reflection Cadence**: Reflections appear roughly 1-2 times per in-game day per agent (configurable)
4. **Memory Limits**: After 3 in-game days:
   - Observations ≤ 200 per agent
   - Reflections ≤ 50 per agent
   - No conversation groups older than 48 hours unsummarized
5. **Performance**: Memory operations complete in <10ms; pruning in <100ms
6. **Fallback Reliability**: System continues working when LLM is unavailable

---

## Dependencies

- Phase 3 `OllamaClient` and `PromptTemplates`
- Phase 2 `TimeManager` with boundary events
- `zod` for schema validation
- `uuid` for memory IDs

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Memory Types | 1 |
| MemoryStream | 3 |
| Scoring Functions | 2 |
| Retriever | 2 |
| Planning System | 4 |
| Reflection System | 3 |
| Summarizer | 2 |
| Pruner | 2 |
| Perception | 2 |
| Action Integration | 3 |
| Testing | 4 |
| **Total** | **28** |

---

## Folder Reference

Implementation folder: `phase4-memory-reflection`
