import { describe, expect, test } from 'vitest';
import {
  ClientEventSchema,
  ControlAckEventSchema,
  JoinAckEventSchema,
  ServerEventSchema,
} from './Events';

describe('Events schemas', () => {
  test('parses join and control client events', () => {
    const join = ClientEventSchema.safeParse({
      type: 'join',
      protocolVersion: 1,
    });
    expect(join.success).toBe(true);

    const control = ClientEventSchema.safeParse({
      type: 'control',
      action: 'setSpeed',
      value: 4,
    });
    expect(control.success).toBe(true);
  });

  test('parses joinAck and controlAck server events', () => {
    const joinAck = JoinAckEventSchema.safeParse({
      type: 'joinAck',
      protocolVersion: 1,
      accepted: true,
      tickId: 12,
    });
    expect(joinAck.success).toBe(true);
    expect(ServerEventSchema.safeParse(joinAck.success ? joinAck.data : null).success).toBe(true);

    const controlAck = ControlAckEventSchema.safeParse({
      type: 'controlAck',
      action: 'pause',
      accepted: false,
      tickId: 12,
      reason: 'join required',
    });
    expect(controlAck.success).toBe(true);
    expect(ServerEventSchema.safeParse(controlAck.success ? controlAck.data : null).success).toBe(true);
  });
});
