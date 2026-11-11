import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/control-horario/',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'off',
  },
  projects: [{ name: 'movil', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'node tests/e2e/servidor.mjs',
    url: 'http://localhost:4173/control-horario/',
    reuseExistingServer: !process.env.CI,
  },
});
