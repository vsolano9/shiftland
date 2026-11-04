// End-to-end checks against the production build served over HTTP (itch serves over HTTP; ES-module builds do not
// run from file://). `npm run e2e` builds first, then Playwright starts `vite preview` on port 4327.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000, // these run on software GL at a few frames a second; a busy PC took a healthy 30 s test past the default
  reporter: 'list',
  use: { baseURL: 'http://localhost:4327/' },
  webServer: { command: 'npm run preview', url: 'http://localhost:4327/', reuseExistingServer: false, timeout: 60_000 },
});
