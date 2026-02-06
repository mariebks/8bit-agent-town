import { expect, test } from '@playwright/test';

const getGameState = async (page: import('@playwright/test').Page) => {
  return page.evaluate(() => {
    const game = window.__agentTownGame;
    if (!game) {
      return null;
    }

    const scene = game.scene.getScene('TownScene');
    const camera = scene.cameras.main;

    return {
      isRunning: game.isRunning,
      activeScene: scene.scene.key,
      mapWidth: Number((scene as Record<string, unknown>).map?.width ?? 0),
      mapHeight: Number((scene as Record<string, unknown>).map?.height ?? 0),
      cameraScrollX: camera.scrollX,
      cameraScrollY: camera.scrollY,
      canvasWidth: game.canvas.width,
      canvasHeight: game.canvas.height,
    };
  });
};

const waitForTownScene = async (page: import('@playwright/test').Page) => {
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          return window.__agentTownGame?.scene.isActive('TownScene') ?? false;
        });
      },
      {
        timeout: 15_000,
        intervals: [100, 200, 500],
      },
    )
    .toBe(true);
};

test.describe('8-bit Agent Town smoke', () => {
  test('boots and renders the Town scene without runtime errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const isExpectedOfflineSocketError =
          /WebSocket connection to 'ws:\/\/(?:127\.0\.0\.1|localhost):4000\/ws' failed/.test(text) &&
          text.includes('ERR_CONNECTION_REFUSED');

        if (!isExpectedOfflineSocketError) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');

    await expect(page.locator('#game-container canvas')).toBeVisible();
    await expect(page.locator('#fps-overlay')).toContainText('FPS:');

    await waitForTownScene(page);

    const state = await getGameState(page);
    expect(state).not.toBeNull();
    expect(state?.isRunning).toBe(true);
    expect(state?.activeScene).toBe('TownScene');
    expect(state?.mapWidth).toBe(40);
    expect(state?.mapHeight).toBe(30);
    expect(state?.canvasWidth).toBeGreaterThan(0);
    expect(state?.canvasHeight).toBeGreaterThan(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('moves selected agent along a computed path', async ({ page }) => {
    await page.goto('/');

    await waitForTownScene(page);

    const pathInfo = await page.evaluate(() => {
      const game = window.__agentTownGame;
      if (!game) {
        return null;
      }

      const scene = game.scene.getScene('TownScene') as unknown as {
        selectedAgent?: {
          currentTile: { tileX: number; tileY: number };
          setPath: (path: { tileX: number; tileY: number }[]) => void;
        };
        astar?: {
          findPath: (
            from: { tileX: number; tileY: number },
            to: { tileX: number; tileY: number },
          ) => { tileX: number; tileY: number }[] | null;
        };
      };

      const selectedAgent = scene.selectedAgent;
      const astar = scene.astar;
      if (!selectedAgent || !astar) {
        return null;
      }

      const start = selectedAgent.currentTile;
      const candidates = [
        { tileX: start.tileX + 2, tileY: start.tileY },
        { tileX: start.tileX + 2, tileY: start.tileY + 2 },
        { tileX: start.tileX, tileY: start.tileY + 2 },
      ];

      for (const target of candidates) {
        const path = astar.findPath(start, target);
        if (path && path.length > 0) {
          selectedAgent.setPath(path);
          return { start, target };
        }
      }

      return null;
    });

    expect(pathInfo).not.toBeNull();

    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const game = window.__agentTownGame;
            if (!game) {
              return null;
            }

            const scene = game.scene.getScene('TownScene') as unknown as {
              selectedAgent?: {
                currentTile: { tileX: number; tileY: number };
              };
            };

            return scene.selectedAgent?.currentTile ?? null;
          });
        },
        {
          timeout: 3_000,
          intervals: [100, 200, 250],
        },
      )
      .toEqual(pathInfo?.target ?? null);
  });
});
