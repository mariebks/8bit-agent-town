import { createServer, Server as HttpServer } from 'node:http';
import { WS_PROTOCOL_VERSION } from '@shared/Constants';
import {
  ClientEventSchema,
  ControlAckEvent,
  ControlEvent,
  DeltaEvent,
  JoinAckEvent,
  SnapshotEvent,
} from '@shared/Events';
import { WebSocketServer, WebSocket } from 'ws';

interface WsServerOptions {
  server: HttpServer;
  path?: string;
  protocolVersion?: number;
  getCurrentTickId?: () => number;
  onControlEvent: (event: ControlEvent) => boolean;
}

interface WsConnectionState {
  joined: boolean;
  protocolVersion: number | null;
}

export class WsServer {
  private readonly server: WebSocketServer;
  private readonly protocolVersion: number;
  private readonly getCurrentTickId: () => number;
  private readonly onControlEvent: (event: ControlEvent) => boolean;
  private readonly connectionState = new WeakMap<WebSocket, WsConnectionState>();
  private snapshotProvider: (() => SnapshotEvent) | null = null;

  constructor(options: WsServerOptions) {
    this.protocolVersion = options.protocolVersion ?? WS_PROTOCOL_VERSION;
    this.getCurrentTickId = options.getCurrentTickId ?? (() => 0);
    this.onControlEvent = options.onControlEvent;

    this.server = new WebSocketServer({
      server: options.server,
      path: options.path ?? '/ws',
    });

    this.server.on('connection', (socket) => {
      this.connectionState.set(socket, {
        joined: false,
        protocolVersion: null,
      });

      socket.on('message', (raw) => {
        let payload: unknown;
        try {
          payload = JSON.parse(raw.toString());
        } catch {
          return;
        }

        const parsed = ClientEventSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }

        if (parsed.data.type === 'join') {
          this.handleJoin(socket, parsed.data.protocolVersion);
          return;
        }

        this.handleControl(socket, parsed.data);
      });

      socket.on('close', () => {
        this.connectionState.delete(socket);
      });
    });
  }

  setSnapshotProvider(provider: () => SnapshotEvent): void {
    this.snapshotProvider = provider;
  }

  broadcastDelta(deltaEvent: DeltaEvent): void {
    for (const client of this.server.clients) {
      if (!this.isJoined(client)) {
        continue;
      }
      this.send(client, deltaEvent);
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private handleJoin(socket: WebSocket, protocolVersion: number): void {
    const state = this.connectionState.get(socket);
    if (!state) {
      return;
    }

    if (protocolVersion !== this.protocolVersion) {
      const rejection: JoinAckEvent = {
        type: 'joinAck',
        protocolVersion: this.protocolVersion,
        accepted: false,
        tickId: this.getCurrentTickId(),
        reason: `Protocol mismatch: expected ${this.protocolVersion}, got ${protocolVersion}`,
      };
      this.send(socket, rejection);
      socket.close(1002, 'protocol mismatch');
      return;
    }

    state.joined = true;
    state.protocolVersion = protocolVersion;

    const accepted: JoinAckEvent = {
      type: 'joinAck',
      protocolVersion: this.protocolVersion,
      accepted: true,
      tickId: this.getCurrentTickId(),
    };
    this.send(socket, accepted);

    const snapshot = this.snapshotProvider?.();
    if (snapshot) {
      this.send(socket, snapshot);
    }
  }

  private handleControl(socket: WebSocket, event: ControlEvent): void {
    if (!this.isJoined(socket)) {
      const rejected: ControlAckEvent = {
        type: 'controlAck',
        action: event.action,
        accepted: false,
        tickId: this.getCurrentTickId(),
        reason: 'join required',
      };
      this.send(socket, rejected);
      return;
    }

    const accepted = this.onControlEvent(event);
    const ack: ControlAckEvent = {
      type: 'controlAck',
      action: event.action,
      accepted,
      tickId: this.getCurrentTickId(),
      reason: accepted ? undefined : 'control rejected',
    };
    this.send(socket, ack);
  }

  private isJoined(socket: WebSocket): boolean {
    return this.connectionState.get(socket)?.joined ?? false;
  }

  private send(socket: WebSocket, payload: SnapshotEvent | DeltaEvent | JoinAckEvent | ControlAckEvent): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }
}

export function createHttpServer(): HttpServer {
  return createServer();
}
