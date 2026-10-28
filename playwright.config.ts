import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Smoke tests against a production build: on-demand regeneration after an admin save only exists there.
// Own port, build folder and database, so a running `pnpm dev` and its data are left alone.
const PORT = 3100;
const env = `GEO_DB_FILE=${path.resolve('.local/e2e.db')} NEXT_DIST_DIR=.next-e2e`;

export default defineConfig({
  testDir: 'e2e',
  workers: 1, // one shared database and the admin test writes to it: run files one at a time (fullyParallel alone does not).
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${env} pnpm seed && ${env} pnpm --filter frontend build && ${env} pnpm --filter frontend exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/products`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
