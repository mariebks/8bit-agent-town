import { ControlEvent, DeltaEvent, SnapshotEvent, DeltaEventSchema, SnapshotEventSchema } from '@shared/Events';

type SnapshotHandler = (event: SnapshotEvent) => void;
type DeltaHandler = (event: DeltaEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

interface SimulationSocketOptions {
  url?: string;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export class SimulationSocket {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectAttempts: number;

  private socket: WebSocket | null = null;
  private closedByClient = false;
  private reconnectAttempts = 0;

  private readonly snapshotHandlers = new Set<SnapshotHandler>();
  private readonly deltaHandlers = new Set<DeltaHandler>();
  private readonly connectionHandlers = new Set<ConnectionHandler>();

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
      this.emitConnection(true);
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

      if (payload.type === 'snapshot') {
        for (const handler of this.snapshotHandlers) {
          handler(payload);
        }
        return;
      }

      if (payload.type === 'delta') {
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

  private emitConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  private parse(raw: unknown): SnapshotEvent | DeltaEvent | null {
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

    return null;
  }
}
