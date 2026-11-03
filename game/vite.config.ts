/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base './' so the build runs from any folder (itch.io serves the zip from a nested path).
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  // unit tests only; e2e/*.spec.ts run under Playwright (`npm run e2e`)
  test: { include: ['src/**/*.test.ts'] },
});
