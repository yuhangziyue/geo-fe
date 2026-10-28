import { defineConfig } from 'vitest/config';

// Frontend unit tests are pure modules (chart option builders, token/contrast checks) — no DOM needed.
// Component interaction is covered by the root-level Playwright e2e suite.
export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', '.next-e2e', '.next-check'],
    environment: 'node',
  },
});
