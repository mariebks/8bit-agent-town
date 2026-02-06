# Phase 3: LLM Integration and Action Selection

## Implementation Plan

### Objectives

1. **Connect Local LLM Inference**: Integrate Ollama client for local LLM calls with proper timeout, retry, and queue management
2. **Safe Action Selection**: Use LLM for high-level action decisions with strict JSON validation
3. **Graceful Fallbacks**: Ensure agents continue functioning when LLM is unavailable or returns invalid responses
4. **Performance Protection**: Limit concurrent LLM calls and restrict LLM-enabled agents to prevent simulation stalls

## Expert corrections (supersedes conflicting details below)

1. Queue freshness and backpressure are mandatory:
   - Add request TTL and drop stale cognitive requests before execution.
   - Prefer dropping outdated low-priority work over growing unbounded queue latency.
2. Retry policy must be selective:
   - Retry only transient transport failures.
   - Do not retry model-invalid JSON responses; use immediate fallback to reduce queue pressure.
3. Initial LLM coverage should be conservative on M4 Air:
   - Start with 2-3 LLM-enabled agents and scale only after queue/tick metrics remain healthy.
4. Tick loop safety:
   - LLM calls run off-loop and resolve into deferred actions.
   - Simulation ticks must continue even if the model is slow/unavailable.
5. Prompt budget discipline:
   - Keep prompts short and structured, with explicit token/character caps.
   - Always include schema reminders and fallback behavior metadata in debug logs.

### End State Requirements

- Start with 2-3 agents requesting LLM actions; scale up only after queue/tick metrics are healthy
- Agents fall back to rule-based actions when LLM is unavailable or times out
- LLM request rate stays below 1 concurrent call and does not stall the simulation loop
- "Last LLM response" debug entry available in server log for inspection

---

## Approach

### Architecture Overview

```
Agent Decision Cycle
        │
        ▼
┌─────────────────────┐
│ Rule-Based Check    │ ◄── Can rules handle this situation?
└─────────────────────┘
        │
    No  │  Yes ──► Use rule-based action
        ▼
┌─────────────────────┐
│ Is Agent LLM-       │ ◄── Start with 2-3 agents, scale cautiously
│ Enabled?            │
└─────────────────────┘
        │
    No  │  Yes
        │    │
        ▼    ▼
   Fallback  ┌─────────────────────┐
   Action    │ RequestQueue        │ ◄── Priority queue, max concurrency 1
             └─────────────────────┘
                      │
                      ▼
             ┌─────────────────────┐
             │ OllamaClient        │ ◄── HTTP call with timeout/retry
             └─────────────────────┘
                      │
                      ▼
             ┌─────────────────────┐
             │ Zod Validation      │ ◄── Parse and validate JSON response
             └─────────────────────┘
                      │
            Valid     │  Invalid
                      │
                 ▼    ▼
            Execute   Log error + use fallback action
            Action
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM Runtime | Ollama | Local inference server |
| Model | `llama3.2:3b` or `phi3:mini` | Small, fast models for M4 MacBook |
| Request Queue | `p-queue` | Single concurrency, priority ordering |
| Validation | `zod` | Runtime JSON schema validation |
| HTTP Client | Native `fetch` | Simple, no extra dependencies |

---

## Project Structure

```
src/server/llm/
├── OllamaClient.ts      # HTTP client with timeout/retry logic
├── RequestQueue.ts      # Priority queue wrapper around p-queue
├── PromptTemplates.ts   # Action selection prompt builders
├── ResponseSchemas.ts   # Zod schemas for LLM responses
└── index.ts             # Module exports
```

---

## Step-by-Step Implementation

### Task 1: Create ResponseSchemas.ts

**Purpose**: Define strict JSON schemas for all LLM responses using Zod

**File**: `src/server/llm/ResponseSchemas.ts`

**Implementation Details**:

```typescript
import { z } from 'zod';

// Available actions the LLM can choose
export const ActionType = z.enum([
  'MOVE_TO',        // Navigate to a location
  'START_ACTIVITY', // Begin an activity at current location
  'TALK_TO',        // Initiate conversation with nearby agent
  'WAIT',           // Stay idle briefly
  'GO_HOME',        // Return to home location
  'EAT',            // Find food/eat
  'SLEEP',          // Go to bed
  'WORK'            // Go to work location
]);

// Main action selection response schema
export const ActionResponseSchema = z.object({
  action: ActionType,
  target: z.string().optional(),      // Location name or agent name
  reason: z.string().max(200),        // Brief explanation (for debugging)
  urgency: z.number().min(1).max(10).optional().default(5)
});

// Type inference for TypeScript
export type ActionResponse = z.infer<typeof ActionResponseSchema>;
export type ActionTypeEnum = z.infer<typeof ActionType>;

// Fallback action when parsing fails
export const FALLBACK_ACTION: ActionResponse = {
  action: 'WAIT',
  reason: 'LLM response parsing failed',
  urgency: 1
};

// Parse with fallback - never throws
export function parseActionResponse(raw: unknown): {
  success: boolean;
  data: ActionResponse;
  error?: string;
} {
  const result = ActionResponseSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    data: FALLBACK_ACTION,
    error: result.error.message
  };
}
```

**Validation Rules**:
- `action`: Must be one of the predefined ActionType enum values
- `target`: Optional string for location/agent reference
- `reason`: Required, max 200 characters to prevent verbose responses
- `urgency`: Optional 1-10 scale, defaults to 5

**Success Criteria**:
- Schema rejects any response missing required `action` or `reason` fields
- Schema rejects unknown action types
- `parseActionResponse` never throws exceptions
- Invalid responses return `FALLBACK_ACTION` with error details

---

### Task 2: Create OllamaClient.ts

**Purpose**: HTTP client for Ollama API with timeout, retries, and error handling

**File**: `src/server/llm/OllamaClient.ts`

**Implementation Details**:

```typescript
export interface OllamaConfig {
  baseUrl: string;           // Default: 'http://localhost:11434'
  model: string;             // Default: 'llama3.2:3b'
  timeout: number;           // Default: 15000ms
  maxRetries: number;        // Default: 1 (transient transport failures only)
  retryDelay: number;        // Default: 500ms
  temperature: number;       // Default: 0.3
  debug: boolean;            // Default: false
}

export interface OllamaRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface OllamaResponse {
  success: boolean;
  content?: string;
  error?: string;
  latencyMs: number;
  retries: number;
}

export class OllamaClient {
  private config: OllamaConfig;
  private lastResponse: OllamaResponse | null = null;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
      model: config.model ?? 'llama3.2:3b',
      timeout: config.timeout ?? 15000,
      maxRetries: config.maxRetries ?? 1,
      retryDelay: config.retryDelay ?? 500,
      temperature: config.temperature ?? 0.3,
      debug: config.debug ?? false
    };
  }

  async generate(request: OllamaRequest): Promise<OllamaResponse> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let retries = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(request);
        this.lastResponse = response;
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries = attempt;

        // Retry only transport/transient failures, not schema/JSON/model-output failures
        if (attempt < this.config.maxRetries && this.isRetryableError(lastError)) {
          await this.sleep(this.config.retryDelay);
        } else {
          break;
        }
      }
    }

    const response: OllamaResponse = {
      success: false,
      error: lastError ?? 'Unknown error',
      latencyMs: Date.now() - startTime,
      retries
    };
    this.lastResponse = response;
    return response;
  }

  private async makeRequest(request: OllamaRequest): Promise<OllamaResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: false,
          format: 'json',  // Force JSON output
          options: {
            temperature: request.temperature ?? this.config.temperature
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (this.config.debug) {
        console.log('[OllamaClient] Response:', data.response);
      }

      return {
        success: true,
        content: data.response,
        latencyMs: Date.now() - startTime,
        retries: 0
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(errorMessage: string): boolean {
    return /timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|5\\d\\d/i.test(errorMessage);
  }

  getLastResponse(): OllamaResponse | null {
    return this.lastResponse;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

**Key Features**:
- **Timeout**: Configurable timeout (default 15s) using AbortController
- **Retries**: Up to 2 retries with configurable delay between attempts
- **JSON Mode**: Forces `format: 'json'` in Ollama requests
- **Health Check**: Simple endpoint to verify Ollama availability
- **Debug Mode**: Logs raw responses when enabled
- **Last Response Tracking**: Stores last response for debug inspection

**Success Criteria**:
- Client times out after configured duration without hanging
- Only transient transport failures are retried up to maxRetries times
- Health check returns false when Ollama is not running
- `getLastResponse()` returns the most recent response for debugging

---

### Task 3: Create RequestQueue.ts

**Purpose**: Priority queue to manage LLM requests with single concurrency

**File**: `src/server/llm/RequestQueue.ts`

**Implementation Details**:

```typescript
import PQueue from 'p-queue';

export enum RequestPriority {
  DIALOGUE = 0,      // Highest - conversation responses need to be fast
  PLAN_UPDATE = 1,   // High - action decisions
  REFLECTION = 2,    // Medium - can be slightly delayed
  IMPORTANCE = 3     // Low - background scoring tasks
}

export interface QueuedRequest<T> {
  id: string;
  priority: RequestPriority;
  execute: () => Promise<T>;
  timestamp: number;
  ttlMs?: number; // Drop if stale before execution
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  droppedStale: number;
  avgLatencyMs: number;
}

export class RequestQueue {
  private queue: PQueue;
  private stats: {
    completed: number;
    failed: number;
    droppedStale: number;
    totalLatency: number;
  };
  private minDelayMs: number;
  private lastRequestTime: number;

  constructor(minDelayMs: number = 100) {
    this.queue = new PQueue({
      concurrency: 1,      // Single concurrent request
      intervalCap: 1,      // Max 1 request per interval
      interval: minDelayMs // Minimum delay between requests
    });
    this.stats = { completed: 0, failed: 0, droppedStale: 0, totalLatency: 0 };
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
  }

  async add<T>(
    execute: () => Promise<T>,
    priority: RequestPriority = RequestPriority.PLAN_UPDATE,
    ttlMs: number = 15000
  ): Promise<T> {
    const startTime = Date.now();
    const enqueuedAt = Date.now();

    try {
      const result = await this.queue.add(
        async () => {
          if (Date.now() - enqueuedAt > ttlMs) {
            this.stats.droppedStale++;
            throw new Error('Dropped stale queued request');
          }

          // Enforce minimum delay between requests
          const timeSinceLastRequest = Date.now() - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelayMs) {
            await new Promise(resolve => 
              setTimeout(resolve, this.minDelayMs - timeSinceLastRequest)
            );
          }
          this.lastRequestTime = Date.now();
          return execute();
        },
        { priority }
      );

      this.stats.completed++;
      this.stats.totalLatency += Date.now() - startTime;

      return result as T;
    } catch (error) {
      this.stats.failed++;
      throw error;
    }
  }

  getStats(): QueueStats {
    return {
      pending: this.queue.pending,
      running: this.queue.pending > 0 ? 1 : 0,
      completed: this.stats.completed,
      failed: this.stats.failed,
      droppedStale: this.stats.droppedStale,
      avgLatencyMs: this.stats.completed > 0 
        ? Math.round(this.stats.totalLatency / this.stats.completed) 
        : 0
    };
  }

  isPaused(): boolean {
    return this.queue.isPaused;
  }

  pause(): void {
    this.queue.pause();
  }

  resume(): void {
    this.queue.start();
  }

  clear(): void {
    this.queue.clear();
  }

  get size(): number {
    return this.queue.size;
  }

  get pending(): number {
    return this.queue.pending;
  }
}
```

**Key Features**:
- **Single Concurrency**: Only one LLM request at a time
- **Priority Ordering**: Higher priority requests (lower number) execute first
- **Minimum Delay**: Enforces delay between requests to prevent overload
- **Statistics**: Tracks completed/failed counts and average latency
- **Pause/Resume**: Can pause queue during simulation pause

**Success Criteria**:
- No more than 1 concurrent request at any time
- Higher priority requests are processed before lower priority
- Queue statistics accurately reflect request outcomes
- Queue can be paused without losing pending requests

---

### Task 4: Create PromptTemplates.ts

**Purpose**: Build structured prompts for action selection that fit small local models

**File**: `src/server/llm/PromptTemplates.ts`

**Implementation Details**:

```typescript
import { ActionTypeEnum } from './ResponseSchemas';

export interface AgentContext {
  name: string;
  occupation: string;
  traits: string[];
  currentLocation: string;
  currentActivity: string;
  energy: number;      // 0-100
  hunger: number;      // 0-100
  mood: number;        // 0-100
  timeOfDay: string;   // "morning", "afternoon", "evening", "night"
  hour: number;        // 0-23
}

export interface LocalContext {
  nearbyAgents: string[];
  nearbyLocations: string[];
  recentEvents: string[];
}

// System prompt for action selection - kept short for small models
const ACTION_SYSTEM_PROMPT = `You are an AI controlling a character in a town simulation. 
Respond ONLY with valid JSON in this exact format:
{"action": "ACTION_TYPE", "target": "optional_target", "reason": "brief reason"}

Valid actions: MOVE_TO, START_ACTIVITY, TALK_TO, WAIT, GO_HOME, EAT, SLEEP, WORK

Rules:
- Choose actions that make sense for the character's personality and current state
- Consider the time of day and the character's needs (energy, hunger, mood)
- Keep reasons under 50 words
- Do not include any text outside the JSON object`;

// Maximum character budget for prompts (to stay within small model context)
const MAX_PROMPT_LENGTH = 1500;

export function buildActionPrompt(
  agent: AgentContext,
  local: LocalContext
): { system: string; prompt: string } {
  const statusLine = `Energy: ${agent.energy}%, Hunger: ${agent.hunger}%, Mood: ${agent.mood}%`;
  
  const nearbyInfo = local.nearbyAgents.length > 0
    ? `Nearby people: ${local.nearbyAgents.slice(0, 3).join(', ')}`
    : 'No one nearby';

  const locationInfo = local.nearbyLocations.length > 0
    ? `Nearby places: ${local.nearbyLocations.slice(0, 5).join(', ')}`
    : '';

  const recentInfo = local.recentEvents.length > 0
    ? `Recent: ${local.recentEvents.slice(0, 3).join('; ')}`
    : '';

  let prompt = `Character: ${agent.name}, ${agent.occupation}
Traits: ${agent.traits.slice(0, 3).join(', ')}
Time: ${agent.timeOfDay} (${agent.hour}:00)
Location: ${agent.currentLocation}
Currently: ${agent.currentActivity}
${statusLine}
${nearbyInfo}
${locationInfo}
${recentInfo}

What should ${agent.name} do next?`.trim();

  // Truncate if too long
  if (prompt.length > MAX_PROMPT_LENGTH) {
    prompt = prompt.substring(0, MAX_PROMPT_LENGTH - 3) + '...';
  }

  return {
    system: ACTION_SYSTEM_PROMPT,
    prompt
  };
}

// Helper to determine if rule-based decision is sufficient
export function canUseRuleBasedDecision(agent: AgentContext): {
  canUseRules: boolean;
  suggestedAction?: ActionTypeEnum;
  reason?: string;
} {
  // Critical needs override everything
  if (agent.energy < 15) {
    return { 
      canUseRules: true, 
      suggestedAction: 'SLEEP', 
      reason: 'Critically low energy' 
    };
  }
  
  if (agent.hunger > 85) {
    return { 
      canUseRules: true, 
      suggestedAction: 'EAT', 
      reason: 'Very hungry' 
    };
  }

  // Time-based routines
  const hour = agent.hour;
  
  // Late night - should be sleeping
  if (hour >= 23 || hour < 6) {
    if (agent.currentLocation !== 'Home') {
      return { 
        canUseRules: true, 
        suggestedAction: 'GO_HOME', 
        reason: 'Late night, time to go home' 
      };
    }
    return { 
      canUseRules: true, 
      suggestedAction: 'SLEEP', 
      reason: 'Night time' 
    };
  }

  // Work hours for workers
  if (hour >= 9 && hour < 17 && agent.occupation !== 'Retired' && agent.occupation !== 'Student') {
    if (agent.currentActivity !== 'working') {
      return { 
        canUseRules: true, 
        suggestedAction: 'WORK', 
        reason: 'Work hours' 
      };
    }
  }

  // No clear rule-based action - need LLM
  return { canUseRules: false };
}

// Debug formatting for server logs
export function formatDebugPrompt(
  agentName: string,
  prompt: string,
  response: string | null,
  success: boolean,
  latencyMs: number
): string {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'FAILED';
  
  return `
[LLM Debug] ${timestamp}
Agent: ${agentName}
Status: ${status}
Latency: ${latencyMs}ms
--- Prompt ---
${prompt.substring(0, 500)}${prompt.length > 500 ? '...' : ''}
--- Response ---
${response ?? 'No response'}
---------------
`.trim();
}
```

**Key Features**:
- **Token Budget**: Keeps prompts under 1500 characters for small models
- **Structured Context**: Includes agent profile, status, location, and nearby info
- **Rule-Based Gating**: `canUseRuleBasedDecision` determines if LLM is needed
- **Truncation**: Safely truncates if context is too large
- **Debug Formatting**: Clean log format for inspecting prompts and responses

**Success Criteria**:
- Prompts stay under the character budget
- `canUseRuleBasedDecision` correctly identifies critical needs (sleep, eat)
- Debug output is readable and includes all relevant information

---

### Task 5: Create LLM Module Index

**Purpose**: Clean module exports

**File**: `src/server/llm/index.ts`

```typescript
export { OllamaClient, type OllamaConfig, type OllamaRequest, type OllamaResponse } from './OllamaClient';
export { RequestQueue, RequestPriority, type QueueStats } from './RequestQueue';
export { 
  ActionResponseSchema, 
  ActionType, 
  parseActionResponse, 
  FALLBACK_ACTION,
  type ActionResponse,
  type ActionTypeEnum 
} from './ResponseSchemas';
export {
  buildActionPrompt,
  canUseRuleBasedDecision,
  formatDebugPrompt,
  type AgentContext,
  type LocalContext
} from './PromptTemplates';
```

---

### Task 6: Integrate LLM with Agent Decision System

**Purpose**: Wire LLM into the existing agent decision cycle

**File**: Modify `src/server/agents/Agent.ts` or create `src/server/agents/cognition/Act.ts`

**Implementation Details**:

```typescript
import {
  OllamaClient,
  RequestQueue,
  RequestPriority,
  parseActionResponse,
  buildActionPrompt,
  canUseRuleBasedDecision,
  formatDebugPrompt,
  type ActionResponse,
  type AgentContext,
  type LocalContext
} from '../llm';

export interface LLMConfig {
  enabled: boolean;
  maxLLMAgents: number;  // Default: 3
}

export class AgentDecisionManager {
  private ollamaClient: OllamaClient;
  private requestQueue: RequestQueue;
  private llmEnabledAgents: Set<string>;
  private lastDebugEntries: Map<string, string>;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.ollamaClient = new OllamaClient({ debug: true });
    this.requestQueue = new RequestQueue(100); // 100ms min delay
    this.llmEnabledAgents = new Set();
    this.lastDebugEntries = new Map();
    this.config = config;
  }

  // Call this during agent initialization to enable LLM for specific agents
  enableLLMForAgent(agentId: string): boolean {
    if (this.llmEnabledAgents.size >= this.config.maxLLMAgents) {
      return false;
    }
    this.llmEnabledAgents.add(agentId);
    return true;
  }

  async decideAction(
    agentId: string,
    agentContext: AgentContext,
    localContext: LocalContext
  ): Promise<ActionResponse> {
    // Step 1: Try rule-based decision first
    const ruleCheck = canUseRuleBasedDecision(agentContext);
    if (ruleCheck.canUseRules && ruleCheck.suggestedAction) {
      return {
        action: ruleCheck.suggestedAction,
        target: undefined,
        reason: ruleCheck.reason ?? 'Rule-based decision'
      };
    }

    // Step 2: Check if agent has LLM enabled
    if (!this.config.enabled || !this.llmEnabledAgents.has(agentId)) {
      return this.getFallbackAction(agentContext);
    }

    // Step 3: Queue LLM request
    try {
      const result = await this.requestQueue.add(
        () => this.callLLM(agentId, agentContext, localContext),
        RequestPriority.PLAN_UPDATE
      );
      return result;
    } catch (error) {
      console.error(`[LLM] Error for agent ${agentId}:`, error);
      return this.getFallbackAction(agentContext);
    }
  }

  private async callLLM(
    agentId: string,
    agentContext: AgentContext,
    localContext: LocalContext
  ): Promise<ActionResponse> {
    const { system, prompt } = buildActionPrompt(agentContext, localContext);

    const response = await this.ollamaClient.generate({
      prompt,
      systemPrompt: system
    });

    // Store debug entry
    this.lastDebugEntries.set(
      agentId,
      formatDebugPrompt(
        agentContext.name,
        prompt,
        response.content ?? null,
        response.success,
        response.latencyMs
      )
    );

    if (!response.success || !response.content) {
      console.warn(`[LLM] Failed for ${agentContext.name}: ${response.error}`);
      return this.getFallbackAction(agentContext);
    }

    // Parse and validate response
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      console.warn(`[LLM] Invalid JSON from ${agentContext.name}:`, response.content);
      return this.getFallbackAction(agentContext);
    }

    const result = parseActionResponse(parsed);
    if (!result.success) {
      console.warn(`[LLM] Schema validation failed for ${agentContext.name}:`, result.error);
    }

    return result.data;
  }

  private getFallbackAction(agent: AgentContext): ActionResponse {
    // Simple rule-based fallback based on time and status
    const hour = agent.hour;
    
    if (hour >= 22 || hour < 7) {
      return { action: 'GO_HOME', reason: 'Default: night time' };
    }
    if (agent.hunger > 60) {
      return { action: 'EAT', reason: 'Default: feeling hungry' };
    }
    if (agent.energy < 30) {
      return { action: 'GO_HOME', reason: 'Default: low energy' };
    }
    
    return { action: 'WAIT', reason: 'Default: no immediate needs' };
  }

  getDebugEntry(agentId: string): string | undefined {
    return this.lastDebugEntries.get(agentId);
  }

  getQueueStats() {
    return this.requestQueue.getStats();
  }

  async checkHealth(): Promise<boolean> {
    return this.ollamaClient.healthCheck();
  }
}
```

**Integration Points**:
- Called from the simulation tick loop during agent decision phase
- `enableLLMForAgent` called during simulation setup for initial 2-3 agents
- `getDebugEntry` exposed to server log/debug endpoints
- `getQueueStats` exposed to monitoring/UI

---

### Task 7: Add Server-Side Debug Logging

**Purpose**: Log LLM activity for debugging and inspection

**Implementation Details**:

Add to simulation server startup:

```typescript
// In src/server/index.ts or simulation initialization

import { AgentDecisionManager } from './agents/cognition/Act';

const decisionManager = new AgentDecisionManager({
  enabled: true,
  maxLLMAgents: 3
});

// Enable LLM for first 2-3 agents
const agents = simulation.getAgents();
for (let i = 0; i < Math.min(3, agents.length); i++) {
  decisionManager.enableLLMForAgent(agents[i].id);
  console.log(`[LLM] Enabled for agent: ${agents[i].name}`);
}

// Health check on startup
decisionManager.checkHealth().then(healthy => {
  if (!healthy) {
    console.warn('[LLM] Ollama not available - agents will use rule-based fallback');
  } else {
    console.log('[LLM] Ollama connection verified');
  }
});

// Periodic stats logging (every 30 seconds)
setInterval(() => {
  const stats = decisionManager.getQueueStats();
  console.log(`[LLM Queue] Pending: ${stats.pending}, Completed: ${stats.completed}, Failed: ${stats.failed}, Avg Latency: ${stats.avgLatencyMs}ms`);
}, 30000);
```

---

## Dependencies

### NPM Packages (already in project)

```json
{
  "dependencies": {
    "p-queue": "^8.0.0",
    "zod": "^3.23.0"
  }
}
```

### External Requirements

- **Ollama** installed and running: `brew install ollama && ollama serve`
- **Model downloaded**: `ollama pull llama3.2:3b` or `ollama pull phi3:mini`

---

## Testing Strategy

### Unit Tests

Create `src/server/llm/__tests__/`:

1. **ResponseSchemas.test.ts**
   - Valid action response parses correctly
   - Missing required fields return fallback
   - Unknown action types return fallback
   - Extra fields are stripped

2. **PromptTemplates.test.ts**
   - Prompts stay under character limit
   - `canUseRuleBasedDecision` returns correct actions for critical states
   - Context truncation works correctly

3. **RequestQueue.test.ts**
   - Single concurrency is enforced
   - Priority ordering is respected
   - Stats are accurate

### Integration Tests

1. **OllamaClient integration** (requires Ollama running)
   - Health check returns true when running
   - Valid prompt returns parseable JSON
   - Timeout is respected
   - Retry logic works on transient failures

2. **Full decision flow**
   - Agent with critical needs uses rules (no LLM call)
   - LLM-enabled agent queries Ollama when rules insufficient
   - Non-LLM agent uses fallback

### Manual Testing Checklist

- [ ] Start server with Ollama running - 2-3 agents show LLM decisions in logs
- [ ] Stop Ollama - agents continue with rule-based fallback
- [ ] Verify no more than 1 concurrent LLM request in queue stats
- [ ] Check "last LLM response" debug entries are populated
- [ ] Run for 10 simulated minutes - simulation loop doesn't stall

---

## Potential Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Ollama returns malformed JSON | Strict zod validation + FALLBACK_ACTION |
| Ollama unavailable at startup | Health check + graceful degradation to rules |
| LLM responses too slow | 15s timeout + rule-based fallback |
| Queue backlog grows | Single concurrency + priority ordering + min delay |
| Small model gives poor actions | Simple prompt structure + limited action set |
| Token budget exceeded | Character limit in prompt builder + truncation |

---

## Success Criteria Summary

| Requirement | Verification |
|------------|--------------|
| 2-3 agents initially request LLM actions | Count agents with `llmEnabledAgents.has(id)` = true and observe decisions |
| No crash on invalid output | Zod validation + parseActionResponse never throws |
| Fallback when LLM unavailable | Stop Ollama, verify agents continue moving |
| Fallback on timeout | Inject slow response, verify fallback action |
| Max 1 concurrent call | Queue stats show `running <= 1` always |
| No simulation stall | Tick timing stays within 10% of target over 5 min |
| Debug log entries | Call `getDebugEntry(agentId)` returns last prompt/response |

---

## File Checklist

| File | Purpose | Status |
|------|---------|--------|
| `src/server/llm/ResponseSchemas.ts` | Zod schemas for LLM responses | To implement |
| `src/server/llm/OllamaClient.ts` | HTTP client with timeout/retry | To implement |
| `src/server/llm/RequestQueue.ts` | Priority queue wrapper | To implement |
| `src/server/llm/PromptTemplates.ts` | Prompt builders and rule gating | To implement |
| `src/server/llm/index.ts` | Module exports | To implement |
| `src/server/agents/cognition/Act.ts` | Decision manager integration | To implement |
| `src/server/llm/__tests__/*.test.ts` | Unit tests | To implement |

---

## Implementation Order

1. **ResponseSchemas.ts** - Foundation for type safety
2. **OllamaClient.ts** - Core HTTP communication
3. **RequestQueue.ts** - Concurrency control
4. **PromptTemplates.ts** - Prompt construction and rule gating
5. **index.ts** - Module exports
6. **Act.ts / Integration** - Wire into simulation
7. **Tests** - Verify all components
8. **Debug logging** - Add server-side visibility

Total estimated implementation time: 4-6 hours for experienced developer
