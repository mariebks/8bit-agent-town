import { z } from 'zod';
import { AgentState } from './Types';

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const TilePositionSchema = z.object({
  tileX: z.number(),
  tileY: z.number()
});

export const AgentDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: PositionSchema,
  tilePosition: TilePositionSchema,
  state: z.nativeEnum(AgentState),
  color: z.number(),
  path: z.array(TilePositionSchema).optional()
});

export const SnapshotEventSchema = z.object({
  type: z.literal('snapshot'),
  tickId: z.number(),
  gameTime: z.object({
    day: z.number(),
    hour: z.number(),
    minute: z.number(),
    totalMinutes: z.number()
  }),
  agents: z.array(AgentDataSchema)
});

export const DeltaEventSchema = z.object({
  type: z.literal('delta'),
  tickId: z.number(),
  gameTime: z.object({
    day: z.number(),
    hour: z.number(),
    minute: z.number(),
    totalMinutes: z.number()
  }),
  agents: z.array(AgentDataSchema)
});

export const ControlEventSchema = z.object({
  type: z.literal('control'),
  action: z.enum(['pause', 'resume', 'setSpeed']),
  value: z.number().optional()
});

export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>;
export type DeltaEvent = z.infer<typeof DeltaEventSchema>;
export type ControlEvent = z.infer<typeof ControlEventSchema>;
