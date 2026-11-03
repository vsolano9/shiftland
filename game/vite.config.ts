import { defineConfig } from 'vite';

// base './' so the build runs from any folder (itch.io serves the zip from a nested path).
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
