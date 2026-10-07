import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  outputDir: '../../.tmp/doctor-browser-results',
  use: {
    baseURL: 'http://127.0.0.1:5299',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx ../api/tests/doctor-browser-server.ts',
      url: 'http://127.0.0.1:3299/api/health',
      timeout: 180000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    },
    {
      command:
        'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5299 --strictPort',
      url: 'http://127.0.0.1:5299',
      timeout: 60000,
      reuseExistingServer: false,
      env: { VITE_API_URL: 'http://127.0.0.1:3299' },
    },
  ],
});
