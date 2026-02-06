import { createServer, Server as HttpServer } from 'node:http';
import { ClientEvent, ClientEventSchema, DeltaEvent, SnapshotEvent } from '@shared/Events';
import { WebSocketServer, WebSocket } from 'ws';

interface WsServerOptions {
  server: HttpServer;
  path?: string;
  onControlEvent: (event: ClientEvent) => void;
}

export class WsServer {
  private readonly server: WebSocketServer;
  private snapshotProvider: (() => SnapshotEvent) | null = null;

  constructor(options: WsServerOptions) {
    this.server = new WebSocketServer({
      server: options.server,
      path: options.path ?? '/ws',
    });

    this.server.on('connection', (socket) => {
      const snapshot = this.snapshotProvider?.();
      if (snapshot) {
        this.send(socket, snapshot);
      }

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

        options.onControlEvent(parsed.data);
      });
    });
  }

  setSnapshotProvider(provider: () => SnapshotEvent): void {
    this.snapshotProvider = provider;
  }

  broadcastDelta(deltaEvent: DeltaEvent): void {
    for (const client of this.server.clients) {
      this.send(client, deltaEvent);
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private send(socket: WebSocket, payload: SnapshotEvent | DeltaEvent): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }
}

export function createHttpServer(): HttpServer {
  return createServer();
}
