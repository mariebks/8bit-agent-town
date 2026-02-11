import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*fullstack\.spec\.ts/,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'PLAYWRIGHT=1 npx concurrently --kill-others-on-fail --success first "npm run dev:client -- --host 127.0.0.1 --port 3000" "SIM_LLM_ENABLED=0 npm run dev:server"',
    url: 'http://127.0.0.1:3000',
    timeout: 90_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
