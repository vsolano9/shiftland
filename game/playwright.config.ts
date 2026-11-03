// End-to-end checks against the production build served over HTTP (itch serves over HTTP; ES-module builds do not
// run from file://). `npm run e2e` builds first, then Playwright starts `vite preview` on port 4327.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4327/' },
  webServer: { command: 'npm run preview', url: 'http://localhost:4327/', reuseExistingServer: false, timeout: 60_000 },
});
