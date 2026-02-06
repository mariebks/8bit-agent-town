import http from 'node:http';
import express from 'express';
import { TickScheduler } from './simulation/TickScheduler';
import { Simulation } from './simulation/Simulation';
import { WsServer } from './transport/WsServer';
import { loadTownMap } from './world/MapLoader';

const port = Number(process.env.SIM_PORT ?? 4000);
const mapPath = process.env.TOWN_MAP_PATH;
const seed = Number(process.env.SIM_SEED ?? 42);
const agentCount = Number(process.env.SIM_AGENT_COUNT ?? 20);
const llmEnabled = process.env.SIM_LLM_ENABLED !== '0';

const app = express();
const server = http.createServer(app);

const mapData = loadTownMap(mapPath);
const simulation = new Simulation(mapData, {
  seed,
  agentCount,
  llmEnabled,
});

const scheduler = new TickScheduler();

const wsServer = new WsServer({
  server,
  path: '/ws',
  getCurrentTickId: () => scheduler.getCurrentTickId(),
  onControlEvent: (event) => {
    return simulation.applyControl(event);
  },
});

wsServer.setSnapshotProvider(() => simulation.createSnapshotEvent(scheduler.getCurrentTickId()));

scheduler.onTick((tickId) => {
  simulation.tick(tickId);
  wsServer.broadcastDelta(simulation.createDeltaEvent(tickId));
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    tickId: scheduler.getCurrentTickId(),
    gameTime: simulation.timeManager.getGameTime(),
  });
});

app.get('/debug/logs', (_req, res) => {
  res.json({
    logs: simulation.getRecentLogs(),
  });
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[sim] listening on http://127.0.0.1:${port}`);
  scheduler.start();
});

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[sim] shutting down due to ${signal}`);
  scheduler.stop();
  await wsServer.close();

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown(signal)
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[sim] shutdown error', error);
      })
      .finally(() => {
        process.exit(0);
      });
  });
}
