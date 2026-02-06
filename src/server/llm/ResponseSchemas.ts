import { z } from 'zod';

export const ActionTypeSchema = z.enum([
  'MOVE_TO',
  'START_ACTIVITY',
  'TALK_TO',
  'WAIT',
  'GO_HOME',
  'EAT',
  'SLEEP',
  'WORK',
]);

export const ActionResponseSchema = z.object({
  action: ActionTypeSchema,
  target: z.string().optional(),
  reason: z.string().min(1).max(200),
  urgency: z.number().min(1).max(10).optional().default(5),
});

export type ActionType = z.infer<typeof ActionTypeSchema>;
export type ActionResponse = z.infer<typeof ActionResponseSchema>;

export const ImportanceResponseSchema = z.object({
  importance: z.number().min(1).max(10),
  reason: z.string().min(1).max(200).optional(),
});

export type ImportanceResponse = z.infer<typeof ImportanceResponseSchema>;

export const FALLBACK_ACTION: ActionResponse = {
  action: 'WAIT',
  reason: 'Fallback action due to invalid or unavailable LLM response',
  urgency: 1,
};

export function parseActionResponse(raw: unknown): {
  success: boolean;
  data: ActionResponse;
  error?: string;
} {
  const parsed = ActionResponseSchema.safeParse(raw);
  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    data: FALLBACK_ACTION,
    error: parsed.error.message,
  };
}
