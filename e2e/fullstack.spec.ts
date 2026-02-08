import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

type ClockMinutes = number;

function parseClockMinutes(statusText: string): ClockMinutes | null {
  const match = statusText.match(/Day (\d+) (\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  return day * 24 * 60 + hour * 60 + minute;
}

async function waitForTownScene(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          return window.__agentTownGame?.scene.isActive('TownScene') ?? false;
        });
      },
      { timeout: 15_000, intervals: [100, 200, 500] },
    )
    .toBe(true);
}

async function setUiMode(page: import('@playwright/test').Page, label: 'Spectator' | 'Story' | 'Debug'): Promise<void> {
  const modeButton = page.locator('.mode-switcher-panel .ui-btn', { hasText: label });
  await modeButton.click();
  await expect(modeButton).toHaveClass(/active/);
}

async function getSelectedAgentId(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const scene = window.__agentTownGame?.scene.getScene('TownScene') as Record<string, unknown> | undefined;
    const selectedAgent = scene?.selectedAgent as { agentId: string } | undefined;
    return selectedAgent?.agentId ?? null;
  });
}

test.describe('8-bit Agent Town fullstack', () => {
  test('connects to simulation server and pause/resume controls affect game clock', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await setUiMode(page, 'Debug');

    const status = page.locator('.time-controls .panel-footer');
    await expect(status).toContainText('online');

    const initialText = (await status.textContent()) ?? '';
    const initialMinutes = parseClockMinutes(initialText);
    expect(initialMinutes).not.toBeNull();

    await expect
      .poll(async () => parseClockMinutes((await status.textContent()) ?? ''), {
        timeout: 5_000,
        intervals: [200, 400],
      })
      .toBeGreaterThan(initialMinutes ?? -1);

    await page.locator('.time-controls .ui-btn', { hasText: 'Pause' }).click();
    await page.waitForTimeout(1_200);
    const pausedStartText = (await status.textContent()) ?? '';
    const pausedStartMinutes = parseClockMinutes(pausedStartText);
    expect(pausedStartMinutes).not.toBeNull();

    await page.waitForTimeout(1_200);
    const pausedEndText = (await status.textContent()) ?? '';
    const pausedEndMinutes = parseClockMinutes(pausedEndText);
    expect(pausedEndMinutes).not.toBeNull();
    expect((pausedEndMinutes ?? 0) - (pausedStartMinutes ?? 0)).toBeLessThanOrEqual(1);

    await page.locator('.time-controls .ui-btn', { hasText: 'Resume' }).click();
    await expect
      .poll(async () => parseClockMinutes((await status.textContent()) ?? ''), {
        timeout: 5_000,
        intervals: [200, 400],
      })
      .toBeGreaterThan(pausedEndMinutes ?? -1);
  });

  test('supports agent select/deselect, overlay hotkeys, panel toggles, and log export', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await setUiMode(page, 'Debug');
    await expect(page.locator('.time-controls .panel-footer')).toContainText('online');

    await page.locator('.time-controls .ui-btn', { hasText: 'Pause' }).click();

    const clickTargets = await page.evaluate(() => {
      const game = window.__agentTownGame;
      if (!game) {
        return null;
      }

      const scene = game.scene.getScene('TownScene') as Record<string, unknown>;
      const camera = (scene.cameras as { main: { worldView: { x: number; y: number; width: number; height: number } } })
        .main;
      const worldView = camera.worldView;
      const agents = (scene.agents as Array<{ agentId: string; x: number; y: number }> | undefined) ?? [];

      if (agents.length === 0) {
        return null;
      }

      const tileSize = 16;
      let emptyWorld: { x: number; y: number } | null = null;
      for (let y = worldView.y + tileSize; y < worldView.y + worldView.height - tileSize; y += tileSize * 2) {
        for (let x = worldView.x + tileSize; x < worldView.x + worldView.width - tileSize; x += tileSize * 2) {
          const overlapsAgent = agents.some((agent) => Math.hypot(agent.x - x, agent.y - y) < tileSize * 2);
          if (!overlapsAgent) {
            emptyWorld = { x, y };
            break;
          }
        }

        if (emptyWorld) {
          break;
        }
      }

      if (!emptyWorld) {
        emptyWorld = {
          x: worldView.x + tileSize,
          y: worldView.y + tileSize,
        };
      }

      return {
        selectWorld: { x: agents[0].x, y: agents[0].y },
        deselectWorld: { x: emptyWorld.x, y: emptyWorld.y },
      };
    });

    expect(clickTargets).not.toBeNull();

    await page.evaluate((point) => {
      const game = window.__agentTownGame;
      if (!game || !point) {
        return;
      }

      const scene = game.scene.getScene('TownScene') as Record<string, unknown>;
      const input = scene.input as {
        emit: (
          eventName: string,
          payload: {
            button: number;
            worldX: number;
            worldY: number;
            x: number;
            y: number;
            middleButtonDown: () => boolean;
            rightButtonDown: () => boolean;
            leftButtonDown: () => boolean;
          },
        ) => void;
      };
      input.emit('pointerdown', {
        button: 0,
        worldX: point.x,
        worldY: point.y,
        x: point.x,
        y: point.y,
        middleButtonDown: () => false,
        rightButtonDown: () => false,
        leftButtonDown: () => true,
      });
    }, clickTargets?.deselectWorld ?? null);

    await expect
      .poll(async () => getSelectedAgentId(page), {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .toBeNull();

    await page.evaluate((point) => {
      const game = window.__agentTownGame;
      if (!game || !point) {
        return;
      }

      const scene = game.scene.getScene('TownScene') as Record<string, unknown>;
      const input = scene.input as {
        emit: (
          eventName: string,
          payload: {
            button: number;
            worldX: number;
            worldY: number;
            x: number;
            y: number;
            middleButtonDown: () => boolean;
            rightButtonDown: () => boolean;
            leftButtonDown: () => boolean;
          },
        ) => void;
      };
      input.emit('pointerdown', {
        button: 0,
        worldX: point.x,
        worldY: point.y,
        x: point.x,
        y: point.y,
        middleButtonDown: () => false,
        rightButtonDown: () => false,
        leftButtonDown: () => true,
      });
    }, clickTargets?.selectWorld ?? null);

    await expect
      .poll(async () => getSelectedAgentId(page), {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .not.toBeNull();

    await page.evaluate((point) => {
      const game = window.__agentTownGame;
      if (!game || !point) {
        return;
      }

      const scene = game.scene.getScene('TownScene') as Record<string, unknown>;
      const input = scene.input as {
        emit: (
          eventName: string,
          payload: {
            button: number;
            worldX: number;
            worldY: number;
            x: number;
            y: number;
            middleButtonDown: () => boolean;
            rightButtonDown: () => boolean;
            leftButtonDown: () => boolean;
          },
        ) => void;
      };
      input.emit('pointerdown', {
        button: 0,
        worldX: point.x,
        worldY: point.y,
        x: point.x,
        y: point.y,
        middleButtonDown: () => false,
        rightButtonDown: () => false,
        leftButtonDown: () => true,
      });
    }, clickTargets?.deselectWorld ?? null);

    await expect
      .poll(async () => getSelectedAgentId(page), {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .toBeNull();

    const debugPanel = page.locator('.debug-panel');
    const inspectorPanel = page.locator('.inspector-panel');
    const promptPanel = page.locator('.prompt-viewer');
    const logPanel = page.locator('.log-panel');
    await expect(debugPanel).toBeVisible();
    await expect(inspectorPanel).toBeVisible();
    await expect(promptPanel).toBeVisible();
    await expect(logPanel).toBeVisible();

    await page.keyboard.press('d');
    await page.keyboard.press('i');
    await page.keyboard.press('p');
    await page.keyboard.press('l');

    await expect(debugPanel).toBeHidden();
    await expect(inspectorPanel).toBeHidden();
    await expect(promptPanel).toBeHidden();
    await expect(logPanel).toBeHidden();

    await page.keyboard.press('d');
    await page.keyboard.press('i');
    await page.keyboard.press('p');
    await page.keyboard.press('l');

    await expect(debugPanel).toBeVisible();
    await expect(inspectorPanel).toBeVisible();
    await expect(promptPanel).toBeVisible();
    await expect(logPanel).toBeVisible();

    const pathButton = debugPanel.locator('.ui-btn').nth(0);
    const perceptionButton = debugPanel.locator('.ui-btn').nth(1);
    const initialPathLabel = (await pathButton.textContent()) ?? '';
    const initialPerceptionLabel = (await perceptionButton.textContent()) ?? '';

    await page.keyboard.press('v');
    await expect
      .poll(async () => (await pathButton.textContent()) ?? '', { timeout: 3_000, intervals: [100, 200, 400] })
      .not.toBe(initialPathLabel);

    await page.keyboard.press('r');
    await expect
      .poll(async () => (await perceptionButton.textContent()) ?? '', {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .not.toBe(initialPerceptionLabel);

    await page.keyboard.press('d');
    await page.keyboard.press('d');

    const promptStatus = promptPanel.locator('.panel-footer');
    await promptPanel.getByRole('button', { name: 'Copy Prompt' }).click();
    await expect
      .poll(async () => ((await promptStatus.textContent()) ?? '').trim(), {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .not.toBe('');

    await promptPanel.getByRole('button', { name: 'Copy Response' }).click();
    await expect
      .poll(async () => ((await promptStatus.textContent()) ?? '').trim(), {
        timeout: 3_000,
        intervals: [100, 200, 400],
      })
      .not.toBe('');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      logPanel.getByRole('button', { name: 'Export JSON' }).click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const payload = await readFile(downloadedPath ?? '', 'utf8');
    const parsed = JSON.parse(payload) as unknown[];

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test('persists ui mode and surfaces timeline cards', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);

    await setUiMode(page, 'Story');
    await page.reload();
    await waitForTownScene(page);

    await expect(page.locator('.mode-switcher-panel .ui-btn', { hasText: 'Story' })).toHaveClass(/active/);
    await expect(page.locator('.timeline-panel')).toBeVisible();
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as
              | { landmarkGuides?: Array<{ marker: { visible: boolean } }> }
              | undefined;
            if (!scene?.landmarkGuides) {
              return 0;
            }
            return scene.landmarkGuides.filter((guide) => guide.marker.visible).length;
          }),
        { timeout: 5_000, intervals: [200, 400] },
      )
      .toBeGreaterThan(0);

    await setUiMode(page, 'Debug');
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as
              | { landmarkGuides?: Array<{ marker: { visible: boolean } }> }
              | undefined;
            if (!scene?.landmarkGuides) {
              return 0;
            }
            return scene.landmarkGuides.filter((guide) => guide.marker.visible).length;
          }),
        { timeout: 5_000, intervals: [200, 400] },
      )
      .toBe(0);

    await page.locator('.time-controls .ui-btn', { hasText: 'Pause' }).click();
    await page.locator('.time-controls .ui-btn', { hasText: 'Resume' }).click();
    await setUiMode(page, 'Story');

    await expect
      .poll(async () => await page.locator('.timeline-panel .timeline-card').count(), {
        timeout: 10_000,
        intervals: [200, 400, 800],
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => await page.locator('.timeline-panel .timeline-card[data-agent-id]').count(), {
        timeout: 10_000,
        intervals: [200, 400, 800],
      })
      .toBeGreaterThan(0);

    const focusableCard = page.locator('.timeline-panel .timeline-card[data-agent-id]').first();
    const targetAgentId = (await focusableCard.getAttribute('data-agent-id')) ?? '';
    expect(targetAgentId.length).toBeGreaterThan(0);

    await focusableCard.click();
    await expect(page.locator('.timeline-panel .panel-footer')).toContainText('focused');
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as { getSelectedAgentId: () => string | null };
            return scene.getSelectedAgentId();
          }),
        { timeout: 5_000, intervals: [100, 200, 400] },
      )
      .toBe(targetAgentId);
  });

  test('preserves manual zoom when toggling director and follow states', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await setUiMode(page, 'Debug');

    await page.evaluate(() => {
      const scene = window.__agentTownGame?.scene.getScene('TownScene') as { cameras: { main: { setZoom: (value: number) => void } } };
      scene.cameras.main.setZoom(1.42);
    });
    await page.waitForTimeout(700);
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as { cameras: { main: { zoom: number } } };
            return scene.cameras.main.zoom;
          }),
        { timeout: 3_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(1.3);

    await page.locator('.time-controls .ui-btn', { hasText: 'Director:' }).click();
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as { cameras: { main: { zoom: number } } };
            return scene.cameras.main.zoom;
          }),
        { timeout: 3_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(1.3);

    await page.locator('.time-controls .ui-btn', { hasText: 'Follow:' }).click();
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as { cameras: { main: { zoom: number } } };
            return scene.cameras.main.zoom;
          }),
        { timeout: 3_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(1.3);
  });

  test('refreshes sprite texture when server occupation metadata changes', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as
              | {
                  agents?: Array<{
                    agentId: string;
                    agentName: string;
                    x: number;
                    y: number;
                    currentTile: { tileX: number; tileY: number };
                    actorSprite?: { texture?: { key?: string } };
                  }>;
                  applyServerSnapshot: (agents: unknown[], gameTime: unknown) => void;
                }
              | undefined;
            const target = scene?.agents?.[0];
            if (!scene || !target?.actorSprite?.texture?.key) {
              return false;
            }

            const before = target.actorSprite.texture.key;
            scene.applyServerSnapshot(
              [
                {
                  id: target.agentId,
                  name: target.agentName,
                  occupation: 'Town Guard',
                  position: { x: target.x, y: target.y },
                  tilePosition: { tileX: target.currentTile.tileX, tileY: target.currentTile.tileY },
                  state: 'idle',
                  color: 0x2b9f5a,
                },
              ],
              {
                day: 1,
                hour: 9,
                minute: 30,
                totalMinutes: 9 * 60 + 30,
              },
            );

            const after = scene.agents?.[0]?.actorSprite?.texture?.key ?? '';
            return before !== after;
          }),
        { timeout: 3_000, intervals: [100, 200, 400] },
      )
      .toBe(true);
  });

  test('cycles director bookmarks for memorable agents', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await setUiMode(page, 'Story');

    const selected = await page.evaluate(() => {
      const scene = window.__agentTownGame?.scene.getScene('TownScene') as {
        getSelectedAgentId: () => string | null;
        addBookmarkForSelectedAgent: () => string | null;
      };
      const selectedId = scene.getSelectedAgentId();
      scene.addBookmarkForSelectedAgent();
      return selectedId;
    });
    expect(selected).not.toBeNull();

    await page.locator('.time-controls .ui-btn', { hasText: 'Next Bookmark' }).click();
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as {
              getSelectedAgentId: () => string | null;
            };
            return scene.getSelectedAgentId();
          }),
        { timeout: 5_000, intervals: [100, 200, 400] },
      )
      .toBe(selected);
  });

  test('supports keyboard-only agent finder flow', async ({ page }) => {
    await page.goto('/');
    await waitForTownScene(page);
    await setUiMode(page, 'Story');
    await expect(page.locator('.time-controls .panel-footer')).toContainText('online');

    const finderPanel = page.locator('.agent-finder-panel');
    if (!(await finderPanel.isVisible())) {
      await page.keyboard.press('Shift+F');
      await expect(finderPanel).toBeVisible();
    }

    await page.keyboard.press('/');
    const finderInput = page.locator('.agent-finder-panel .ui-input');
    await expect(finderInput).toBeFocused();

    let query = '';
    await expect
      .poll(
        async () => {
          query = await page.evaluate(() => {
            const scene = window.__agentTownGame?.scene.getScene('TownScene') as
              | { agents?: Array<{ agentName: string }> }
              | undefined;
            const name = scene?.agents?.[0]?.agentName?.trim() ?? '';
            return name.toLowerCase();
          });
          return query.length;
        },
        { timeout: 5_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(0);

    await finderInput.fill(query);
    await expect
      .poll(async () => await page.locator('.agent-finder-panel .agent-finder-row').count(), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBeGreaterThanOrEqual(1);

    const firstLabel = ((await page.locator('.agent-finder-panel .agent-finder-row').first().textContent()) ?? '').trim();
    const expectedName = firstLabel.split(' · ')[0] ?? firstLabel;
    expect(expectedName.length).toBeGreaterThan(0);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('.agent-finder-panel .panel-footer')).toContainText(`focused ${expectedName}`);

    const selectedName = await page.evaluate(() => {
      const scene = window.__agentTownGame?.scene.getScene('TownScene') as { selectedAgent?: { agentName: string } } | undefined;
      return scene?.selectedAgent?.agentName ?? null;
    });
    expect(selectedName).toBe(expectedName);
  });
});
