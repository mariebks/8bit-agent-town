import { WS_PROTOCOL_VERSION } from '@shared/Constants';
import {
  ControlAckEvent,
  ControlAckEventSchema,
  ControlEvent,
  DeltaEvent,
  DeltaEventSchema,
  JoinAckEvent,
  JoinAckEventSchema,
  SnapshotEvent,
  SnapshotEventSchema,
} from '@shared/Events';

type SnapshotHandler = (event: SnapshotEvent) => void;
type DeltaHandler = (event: DeltaEvent) => void;
type ConnectionHandler = (connected: boolean) => void;
type JoinAckHandler = (event: JoinAckEvent) => void;
type ControlAckHandler = (event: ControlAckEvent) => void;

interface SimulationSocketOptions {
  url?: string;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export function resolveNextServerTick(
  lastServerTick: number,
  event: SnapshotEvent | DeltaEvent,
): number | null {
  if (event.type === 'snapshot') {
    return event.tickId;
  }

  if (event.tickId <= lastServerTick) {
    return null;
  }

  return event.tickId;
}

export class SimulationSocket {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectAttempts: number;

  private socket: WebSocket | null = null;
  private closedByClient = false;
  private reconnectAttempts = 0;
  private lastServerTick = -1;

  private readonly snapshotHandlers = new Set<SnapshotHandler>();
  private readonly deltaHandlers = new Set<DeltaHandler>();
  private readonly connectionHandlers = new Set<ConnectionHandler>();
  private readonly joinAckHandlers = new Set<JoinAckHandler>();
  private readonly controlAckHandlers = new Set<ControlAckHandler>();

  constructor(options: SimulationSocketOptions = {}) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = options.url ?? `${protocol}//${window.location.hostname}:4000/ws`;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1500;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    this.closedByClient = false;
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.lastServerTick = -1;
      this.sendJoin();
    };

    this.socket.onclose = () => {
      this.emitConnection(false);
      this.socket = null;

      if (this.closedByClient) {
        return;
      }

      this.reconnectAttempts += 1;
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        return;
      }

      const delay = this.reconnectDelayMs * this.reconnectAttempts;
      window.setTimeout(() => this.connect(), delay);
    };

    this.socket.onmessage = (event) => {
      const payload = this.parse(event.data);
      if (!payload) {
        return;
      }

      if (payload.type === 'joinAck') {
        for (const handler of this.joinAckHandlers) {
          handler(payload);
        }

        if (!payload.accepted) {
          this.emitConnection(false);
          this.socket?.close();
          return;
        }

        this.emitConnection(true);
        return;
      }

      if (payload.type === 'controlAck') {
        for (const handler of this.controlAckHandlers) {
          handler(payload);
        }
        return;
      }

      if (payload.type === 'snapshot') {
        const nextTick = resolveNextServerTick(this.lastServerTick, payload);
        if (nextTick === null) {
          return;
        }
        this.lastServerTick = nextTick;
        for (const handler of this.snapshotHandlers) {
          handler(payload);
        }
        return;
      }

      if (payload.type === 'delta') {
        const nextTick = resolveNextServerTick(this.lastServerTick, payload);
        if (nextTick === null) {
          return;
        }
        this.lastServerTick = nextTick;
        for (const handler of this.deltaHandlers) {
          handler(payload);
        }
      }
    };
  }

  disconnect(): void {
    this.closedByClient = true;
    this.reconnectAttempts = 0;
    this.socket?.close();
    this.socket = null;
  }

  sendControl(action: ControlEvent['action'], value?: number): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload: ControlEvent = {
      type: 'control',
      action,
      value,
    };

    this.socket.send(JSON.stringify(payload));
  }

  onSnapshot(handler: SnapshotHandler): () => void {
    this.snapshotHandlers.add(handler);
    return () => this.snapshotHandlers.delete(handler);
  }

  onDelta(handler: DeltaHandler): () => void {
    this.deltaHandlers.add(handler);
    return () => this.deltaHandlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onJoinAck(handler: JoinAckHandler): () => void {
    this.joinAckHandlers.add(handler);
    return () => this.joinAckHandlers.delete(handler);
  }

  onControlAck(handler: ControlAckHandler): () => void {
    this.controlAckHandlers.add(handler);
    return () => this.controlAckHandlers.delete(handler);
  }

  private emitConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  private sendJoin(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: 'join',
        protocolVersion: WS_PROTOCOL_VERSION,
      }),
    );
  }

  private parse(raw: unknown): SnapshotEvent | DeltaEvent | JoinAckEvent | ControlAckEvent | null {
    let payload: unknown;

    try {
      if (typeof raw === 'string') {
        payload = JSON.parse(raw);
      } else if (raw instanceof ArrayBuffer) {
        payload = JSON.parse(new TextDecoder().decode(raw));
      } else {
        return null;
      }
    } catch {
      return null;
    }

    const snapshot = SnapshotEventSchema.safeParse(payload);
    if (snapshot.success) {
      return snapshot.data;
    }

    const delta = DeltaEventSchema.safeParse(payload);
    if (delta.success) {
      return delta.data;
    }

    const joinAck = JoinAckEventSchema.safeParse(payload);
    if (joinAck.success) {
      return joinAck.data;
    }

    const controlAck = ControlAckEventSchema.safeParse(payload);
    if (controlAck.success) {
      return controlAck.data;
    }

    return null;
  }
}
