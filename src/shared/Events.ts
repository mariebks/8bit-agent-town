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
});

export const SimulationMetricsSchema = z.object({
  tickDurationMsP50: z.number(),
  tickDurationMsP95: z.number(),
  tickDurationMsP99: z.number(),
  queueDepth: z.number(),
  queueDropped: z.number(),
  llmFallbackRate: z.number(),
});

export const SnapshotEventSchema = z.object({
  type: z.literal('snapshot'),
  tickId: z.number(),
  gameTime: GameTimeSchema,
  agents: z.array(AgentDataSchema),
  metrics: SimulationMetricsSchema.optional(),
  events: z.array(z.unknown()).optional(),
});

export const DeltaEventSchema = z.object({
  type: z.literal('delta'),
  tickId: z.number(),
  gameTime: GameTimeSchema,
  agents: z.array(AgentDataSchema),
  metrics: SimulationMetricsSchema.optional(),
  events: z.array(z.unknown()).optional(),
});

export const ControlEventSchema = z.object({
  type: z.literal('control'),
  action: z.enum(['pause', 'resume', 'setSpeed']),
  value: z.number().optional(),
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
  reason: z.enum(['maxTurns', 'agentEnded', 'timeout', 'interrupted']),
  gameTime: GameTimeSchema,
});

export const SpeechBubbleEventSchema = z.object({
  type: z.literal('speechBubble'),
  agentId: z.string(),
  message: z.string(),
  durationTicks: z.number(),
});

export const LogEventSchema = z.object({
  type: z.literal('log'),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  agentId: z.string().optional(),
  gameTime: GameTimeSchema.optional(),
});

export const ClientEventSchema = z.discriminatedUnion('type', [ControlEventSchema]);

export const ServerEventSchema = z.discriminatedUnion('type', [
  SnapshotEventSchema,
  DeltaEventSchema,
  ConversationStartEventSchema,
  ConversationTurnEventSchema,
  ConversationEndEventSchema,
  SpeechBubbleEventSchema,
  LogEventSchema,
]);

export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>;
export type DeltaEvent = z.infer<typeof DeltaEventSchema>;
export type ControlEvent = z.infer<typeof ControlEventSchema>;
export type ConversationStartEvent = z.infer<typeof ConversationStartEventSchema>;
export type ConversationTurnEvent = z.infer<typeof ConversationTurnEventSchema>;
export type ConversationEndEvent = z.infer<typeof ConversationEndEventSchema>;
export type SpeechBubbleEvent = z.infer<typeof SpeechBubbleEventSchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ClientEvent = z.infer<typeof ClientEventSchema>;
