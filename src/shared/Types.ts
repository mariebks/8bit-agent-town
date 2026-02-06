export type AgentId = string;
export type LocationId = string;
export type ConversationId = string;

export interface Position {
  x: number;
  y: number;
}

export interface TilePosition {
  tileX: number;
  tileY: number;
}

export enum AgentState {
  Idle = 'idle',
  Walking = 'walking',
  Conversing = 'conversing',
  Activity = 'activity',
  Sleeping = 'sleeping',
}

export interface AgentLlmTrace {
  lastPrompt?: string;
  lastResponse?: string;
  lastOutcome?: 'ok' | 'fallback' | 'error' | 'dropped';
  updatedAtTick?: number;
}

export interface AgentData {
  id: AgentId;
  name: string;
  position: Position;
  tilePosition: TilePosition;
  state: AgentState;
  color: number;
  path?: TilePosition[];
  currentLocationId?: LocationId;
  currentAction?: string;
  mood?: number;
  energy?: number;
  hunger?: number;
  currentGoal?: string;
  currentPlan?: string[];
  lastReflection?: string;
  relationshipSummary?: RelationshipSummary;
  llmTrace?: AgentLlmTrace;
}

export interface LocationData {
  id: LocationId;
  name: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  tags: string[];
  capacity?: number;
  spawnPoint?: TilePosition;
  allowedActivities?: string[];
}

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
  totalMinutes: number;
}

export interface ConversationTurn {
  speakerId: AgentId;
  message: string;
  timestamp: number;
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
  weight: number;
  tags: string[];
  lastInteraction: number;
}

export interface RelationshipSummary {
  friendCount: number;
  rivalCount: number;
  averageWeight: number;
  strongestBondId?: AgentId;
  weakestBondId?: AgentId;
}

export type RelationshipGraph = Record<AgentId, RelationshipEdge[]>;

export interface SimulationMetrics {
  tickDurationMsP50: number;
  tickDurationMsP95: number;
  tickDurationMsP99: number;
  queueDepth: number;
  queueDropped: number;
  llmFallbackRate: number;
  llmQueueMaxDepth?: number;
  llmQueueAvgWaitMs?: number;
  llmQueueAvgProcessMs?: number;
  llmQueueBackpressure?: 'normal' | 'elevated' | 'critical';
  llmQueueHealthy?: boolean;
  pathCacheSize?: number;
  pathCacheHitRate?: number;
}

export const TILE_SIZE = 16;
export const MAP_WIDTH_TILES = 40;
export const MAP_HEIGHT_TILES = 30;
