import { expect, test } from '@playwright/test';

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

test.describe('8-bit Agent Town visual checklist', () => {
  test('captures core mode and density screenshots', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await waitForTownScene(page);
    await expect(page.locator('.time-controls .panel-footer')).toContainText('online');

    const modeButton = (label: 'Spectator' | 'Story' | 'Debug') =>
      page.locator('.mode-switcher-panel .ui-btn', { hasText: label });
    const densityButton = (label: 'Full' | 'Compact') =>
      page.locator('.mode-switcher-panel .ui-btn', { hasText: label });

    await modeButton('Spectator').click();
    await densityButton('Full').click();
    const spectatorPath = testInfo.outputPath('spectator-full.png');
    await page.screenshot({ path: spectatorPath, fullPage: true });
    await testInfo.attach('spectator-full', { path: spectatorPath, contentType: 'image/png' });

    await modeButton('Story').click();
    await densityButton('Compact').click();
    const storyCompactPath = testInfo.outputPath('story-compact.png');
    await page.screenshot({ path: storyCompactPath, fullPage: true });
    await testInfo.attach('story-compact', { path: storyCompactPath, contentType: 'image/png' });

    await modeButton('Debug').click();
    await densityButton('Full').click();
    const debugPath = testInfo.outputPath('debug-full.png');
    await page.screenshot({ path: debugPath, fullPage: true });
    await testInfo.attach('debug-full', { path: debugPath, contentType: 'image/png' });
  });
});
