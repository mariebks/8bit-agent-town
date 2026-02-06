import { describe, expect, test } from 'vitest';
import { parseActionResponse } from './ResponseSchemas';

describe('ResponseSchemas', () => {
  test('parses valid action responses', () => {
    const parsed = parseActionResponse({
      action: 'MOVE_TO',
      target: 'library',
      reason: 'Need to focus',
      urgency: 6,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data.action).toBe('MOVE_TO');
  });

  test('falls back for invalid action payload', () => {
    const parsed = parseActionResponse({
      action: 'FLY',
      reason: 'invalid action',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.data.action).toBe('WAIT');
    expect(parsed.error).toContain('Invalid enum value');
  });
});
