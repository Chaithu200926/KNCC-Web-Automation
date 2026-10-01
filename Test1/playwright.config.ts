/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';
import { testConfig } from './config/test-config';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Keep one recorded attempt per test in CI. */
  retries: 0,
  timeout: 60_000,
  /* Checks wait up to 10 s by default (Playwright's own default is 5 s): the UAT site is often slow to redraw. */
  expect: { timeout: 10_000 },
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Keep terminal output local and publish machine-readable results in CI. */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./reporters/text-reporter.ts', { outputFile: 'test-results/test-execution.log.txt' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL used by the Cinescape smoke test. */
    baseURL: testConfig.urls.home,

    /* Trace of each failed test (step-by-step replay). See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure', // Traces only for failed tests (a trace of every test made the CI report bundle about 4 GB).
    /* No click or fill waits longer than 60 s (otherwise a stuck click only stops at the test timeout). */
    actionTimeout: 60_000,
    screenshot: 'on',
    video: 'on',

    /* Incognito: every test gets a brand-new private browser context (no cookies, cache, local storage or sign-in
       from earlier tests are kept, and nothing is written to a browser profile), so no cache clearing is needed.
       Chromium also starts in incognito mode, and service workers (which can serve cached pages) are blocked. */
    launchOptions: { args: ['--incognito'] },
    serviceWorkers: 'block',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox is blocked by the local Windows Application Control policy.
    // WebKit is unavailable until its Windows runtime dependencies are installed.
    // Re-enable these projects when the machine policy and dependencies allow them.

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
