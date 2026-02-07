import http from 'node:http';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { WS_PROTOCOL_VERSION } from '@shared/Constants';
import { ControlEvent, DeltaEvent, SnapshotEvent } from '@shared/Events';
import { WsServer } from './WsServer';

interface FakeSocket {
  readyState: number;
  sent: unknown[];
  closed: { code?: number; reason?: string };
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
}

const instances: WsServer[] = [];

afterEach(async () => {
  while (instances.length > 0) {
    const next = instances.pop();
    if (!next) {
      continue;
    }
    const internalServer = callPrivate<{ clients: Set<unknown> }>(next, 'server');
    internalServer.clients.clear();
    await next.close();
  }
});

describe('WsServer', () => {
  test('accepts compatible join and sends snapshot', () => {
    const wsServer = createServer(() => true, 8);
    wsServer.setSnapshotProvider(() => buildSnapshot(8));

    const socket = createFakeSocket();
    setConnectionState(wsServer, socket, false);

    callPrivate(wsServer, 'handleJoin', socket, WS_PROTOCOL_VERSION);

    expect(socket.sent).toHaveLength(2);
    expect(socket.sent[0]).toMatchObject({
      type: 'joinAck',
      accepted: true,
      protocolVersion: WS_PROTOCOL_VERSION,
      tickId: 8,
    });
    expect(socket.sent[1]).toMatchObject({
      type: 'snapshot',
      tickId: 8,
    });
  });

  test('rejects incompatible join and closes socket', () => {
    const wsServer = createServer(() => true, 3);
    const socket = createFakeSocket();
    setConnectionState(wsServer, socket, false);

    callPrivate(wsServer, 'handleJoin', socket, WS_PROTOCOL_VERSION + 1);

    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({
      type: 'joinAck',
      accepted: false,
      protocolVersion: WS_PROTOCOL_VERSION,
      tickId: 3,
    });
    expect(String((socket.sent[0] as Record<string, unknown>).reason ?? '')).toContain('Protocol mismatch');
    expect(socket.closed).toMatchObject({ code: 1002, reason: 'protocol mismatch' });
  });

  test('rejects controls before join and accepts after join', () => {
    const controls: ControlEvent[] = [];
    const wsServer = createServer((event) => {
      controls.push(event);
      return true;
    }, 12);
    const socket = createFakeSocket();
    setConnectionState(wsServer, socket, false);

    callPrivate(wsServer, 'handleControl', socket, { type: 'control', action: 'pause' });
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({
      type: 'controlAck',
      action: 'pause',
      accepted: false,
      reason: 'join required',
      tickId: 12,
    });

    setConnectionState(wsServer, socket, true);
    callPrivate(wsServer, 'handleControl', socket, { type: 'control', action: 'setSpeed', value: 4 });
    expect(socket.sent).toHaveLength(2);
    expect(socket.sent[1]).toMatchObject({
      type: 'controlAck',
      action: 'setSpeed',
      accepted: true,
      tickId: 12,
    });
    expect(controls).toEqual([{ type: 'control', action: 'setSpeed', value: 4 }]);
  });

  test('broadcasts deltas only to joined sockets', () => {
    const wsServer = createServer(() => true, 6);
    const joinedSocket = createFakeSocket();
    const unjoinedSocket = createFakeSocket();

    setConnectionState(wsServer, joinedSocket, true);
    setConnectionState(wsServer, unjoinedSocket, false);
    addClient(wsServer, joinedSocket);
    addClient(wsServer, unjoinedSocket);

    const delta = buildDelta(6);
    wsServer.broadcastDelta(delta);

    expect(joinedSocket.sent).toHaveLength(1);
    expect(joinedSocket.sent[0]).toMatchObject({
      type: 'delta',
      tickId: 6,
    });
    expect(unjoinedSocket.sent).toEqual([]);
  });
});

function createServer(onControlEvent: (event: ControlEvent) => boolean, tickId: number): WsServer {
  const server = http.createServer();
  const wsServer = new WsServer({
    server,
    path: '/ws',
    getCurrentTickId: () => tickId,
    onControlEvent,
  });
  instances.push(wsServer);
  return wsServer;
}

function createFakeSocket(): FakeSocket {
  return {
    readyState: WebSocket.OPEN,
    sent: [],
    closed: {},
    send(payload: string) {
      this.sent.push(JSON.parse(payload));
    },
    close(code?: number, reason?: string) {
      this.closed = { code, reason };
      this.readyState = WebSocket.CLOSED;
    },
  };
}

function setConnectionState(wsServer: WsServer, socket: FakeSocket, joined: boolean): void {
  const map = callPrivate<WeakMap<FakeSocket, { joined: boolean; protocolVersion: number | null }>>(wsServer, 'connectionState');
  map.set(socket, {
    joined,
    protocolVersion: joined ? WS_PROTOCOL_VERSION : null,
  });
}

function addClient(wsServer: WsServer, socket: FakeSocket): void {
  const internalServer = callPrivate<{ clients: Set<FakeSocket> }>(wsServer, 'server');
  internalServer.clients.add(socket);
}

function callPrivate<T = unknown>(instance: object, key: string, ...args: unknown[]): T {
  const target = instance as Record<string, unknown>;
  const value = target[key];
  if (typeof value === 'function') {
    return (value as (...fnArgs: unknown[]) => T).apply(instance, args);
  }
  return value as T;
}

function buildSnapshot(tickId: number): SnapshotEvent {
  return {
    type: 'snapshot',
    tickId,
    gameTime: { day: 0, hour: 8, minute: 0, totalMinutes: 480 },
    agents: [],
  };
}

function buildDelta(tickId: number): DeltaEvent {
  return {
    type: 'delta',
    tickId,
    gameTime: { day: 0, hour: 8, minute: 1, totalMinutes: 481 },
    agents: [],
  };
}
