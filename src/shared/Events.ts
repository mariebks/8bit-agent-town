import { z } from 'zod';
import { AgentState } from './Types';

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const TilePositionSchema = z.object({
  tileX: z.number(),
  tileY: z.number(),
});

export const GameTimeSchema = z.object({
  day: z.number(),
  hour: z.number(),
  minute: z.number(),
  totalMinutes: z.number(),
});

export const AgentDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  occupation: z.string().optional(),
  position: PositionSchema,
  tilePosition: TilePositionSchema,
  state: z.nativeEnum(AgentState),
  color: z.number(),
  path: z.array(TilePositionSchema).optional(),
  currentLocationId: z.string().optional(),
  currentAction: z.string().optional(),
  mood: z.number().optional(),
  energy: z.number().optional(),
  hunger: z.number().optional(),
  currentGoal: z.string().optional(),
  currentPlan: z.array(z.string()).optional(),
  lastReflection: z.string().optional(),
  relationshipSummary: z
    .object({
      friendCount: z.number(),
      rivalCount: z.number(),
      averageWeight: z.number(),
      strongestBondId: z.string().optional(),
      weakestBondId: z.string().optional(),
    })
    .optional(),
  relationshipEdges: z
    .array(
      z.object({
        targetId: z.string(),
        weight: z.number(),
        tags: z.array(z.string()),
        lastInteraction: z.number(),
      }),
    )
    .optional(),
  llmTrace: z
    .object({
      lastPrompt: z.string().optional(),
      lastResponse: z.string().optional(),
      lastOutcome: z.enum(['ok', 'fallback', 'error', 'dropped']).optional(),
      updatedAtTick: z.number().optional(),
    })
    .optional(),
});

export const SimulationMetricsSchema = z.object({
  tickDurationMsP50: z.number(),
  tickDurationMsP95: z.number(),
  tickDurationMsP99: z.number(),
  queueDepth: z.number(),
  queueDropped: z.number(),
  llmFallbackRate: z.number(),
  llmQueueMaxDepth: z.number().optional(),
  llmQueueAvgWaitMs: z.number().optional(),
  llmQueueAvgProcessMs: z.number().optional(),
  llmQueueBackpressure: z.enum(['normal', 'elevated', 'critical']).optional(),
  llmQueueHealthy: z.boolean().optional(),
  pathCacheSize: z.number().optional(),
  pathCacheHitRate: z.number().optional(),
});

export const SnapshotEventSchema = z.object({
  type: z.literal('snapshot'),
  tickId: z.number().int().nonnegative(),
  gameTime: GameTimeSchema,
  agents: z.array(AgentDataSchema),
  metrics: SimulationMetricsSchema.optional(),
  events: z.array(z.unknown()).optional(),
});

export const DeltaEventSchema = z.object({
  type: z.literal('delta'),
  tickId: z.number().int().nonnegative(),
  gameTime: GameTimeSchema,
  agents: z.array(AgentDataSchema),
  metrics: SimulationMetricsSchema.optional(),
  events: z.array(z.unknown()).optional(),
});

export const ControlActionSchema = z.enum(['pause', 'resume', 'setSpeed']);

export const JoinEventSchema = z.object({
  type: z.literal('join'),
  protocolVersion: z.number().int().min(0),
  clientBuild: z.string().optional(),
});

export const ControlEventSchema = z.object({
  type: z.literal('control'),
  action: ControlActionSchema,
  value: z.number().optional(),
});

export const JoinAckEventSchema = z.object({
  type: z.literal('joinAck'),
  protocolVersion: z.number().int().min(0),
  accepted: z.boolean(),
  tickId: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

export const ControlAckEventSchema = z.object({
  type: z.literal('controlAck'),
  action: ControlActionSchema,
  accepted: z.boolean(),
  tickId: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

export const ConversationStartEventSchema = z.object({
  type: z.literal('conversationStart'),
  conversationId: z.string(),
  participants: z.tuple([z.string(), z.string()]),
  location: z.string(),
  gameTime: GameTimeSchema,
});

export const ConversationTurnEventSchema = z.object({
  type: z.literal('conversationTurn'),
  conversationId: z.string(),
  speakerId: z.string(),
  message: z.string(),
  gameTime: GameTimeSchema,
});

export const ConversationEndEventSchema = z.object({
  type: z.literal('conversationEnd'),
  conversationId: z.string(),
  reason: z.enum([
    'maxTurns',
    'agentEnded',
    'timeout',
    'interrupted',
    'topicExhausted',
    'schedulePressure',
    'socialDiscomfort',
  ]),
  gameTime: GameTimeSchema,
});

export const SpeechBubbleEventSchema = z.object({
  type: z.literal('speechBubble'),
  agentId: z.string(),
  message: z.string(),
  durationTicks: z.number(),
});

export const RelationshipShiftEventSchema = z.object({
  type: z.literal('relationshipShift'),
  sourceId: z.string(),
  targetId: z.string(),
  fromWeight: z.number(),
  toWeight: z.number(),
  stance: z.enum(['friend', 'rival', 'acquaintance']),
  gameTime: GameTimeSchema,
});

export const LocationArrivalEventSchema = z.object({
  type: z.literal('locationArrival'),
  agentId: z.string(),
  locationId: z.string(),
  gameTime: GameTimeSchema,
});

export const TopicSpreadEventSchema = z.object({
  type: z.literal('topicSpread'),
  topic: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  confidence: z.number(),
  gameTime: GameTimeSchema,
});

export const LogEventSchema = z.object({
  type: z.literal('log'),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  agentId: z.string().optional(),
  gameTime: GameTimeSchema.optional(),
});

export const ClientEventSchema = z.discriminatedUnion('type', [JoinEventSchema, ControlEventSchema]);

export const ServerEventSchema = z.discriminatedUnion('type', [
  SnapshotEventSchema,
  DeltaEventSchema,
  JoinAckEventSchema,
  ControlAckEventSchema,
  ConversationStartEventSchema,
  ConversationTurnEventSchema,
  ConversationEndEventSchema,
  SpeechBubbleEventSchema,
  RelationshipShiftEventSchema,
  LocationArrivalEventSchema,
  TopicSpreadEventSchema,
  LogEventSchema,
]);

export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>;
export type DeltaEvent = z.infer<typeof DeltaEventSchema>;
export type JoinEvent = z.infer<typeof JoinEventSchema>;
export type ControlEvent = z.infer<typeof ControlEventSchema>;
export type JoinAckEvent = z.infer<typeof JoinAckEventSchema>;
export type ControlAckEvent = z.infer<typeof ControlAckEventSchema>;
export type ConversationStartEvent = z.infer<typeof ConversationStartEventSchema>;
export type ConversationTurnEvent = z.infer<typeof ConversationTurnEventSchema>;
export type ConversationEndEvent = z.infer<typeof ConversationEndEventSchema>;
export type SpeechBubbleEvent = z.infer<typeof SpeechBubbleEventSchema>;
export type RelationshipShiftEvent = z.infer<typeof RelationshipShiftEventSchema>;
export type LocationArrivalEvent = z.infer<typeof LocationArrivalEventSchema>;
export type TopicSpreadEvent = z.infer<typeof TopicSpreadEventSchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ClientEvent = z.infer<typeof ClientEventSchema>;
