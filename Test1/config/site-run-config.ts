/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';

/**
 * Run settings for one website's copy of the tests (tests-uat, tests-pre-uat): the same settings as
 * playwright.config.ts (incognito, screenshots, videos, reports), with the site's own folder, address and report
 * folders, so a run of one site never overwrites the reports of another.
 *
 * @param name  Short site name used in the report folders, e.g. 'uat' -> playwright-report-uat, test-results-uat.
 * @param testDir  The folder with the site's spec files.
 * @param baseURL  The site's address.
 */
export const siteRunConfig = (name: string, testDir: string, baseURL: string) => defineConfig({
  testDir,
  /* Test files (videos, screenshots, traces) of this site only. */
  outputDir: `test-results-${name}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  /* Checks wait up to 10 s (as for the current UAT site). */
  expect: { timeout: 10_000 },
  /* One test at a time: all tests sign in with the same account, and the site allows one OTP every few minutes. */
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `playwright-report-${name}` }],
    ['junit', { outputFile: `test-results-${name}/results.xml` }],
    ['json', { outputFile: `test-results-${name}/results.json` }],
    ['./reporters/text-reporter.ts', { outputFile: `test-results-${name}/test-execution.log.txt` }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure', // Traces only for failed tests.
    actionTimeout: 60_000,
    screenshot: 'on', // Screenshot of every test.
    video: 'on', // Video of every test.
    /* Incognito: every test gets a brand-new private browser context; service workers are blocked. */
    launchOptions: { args: ['--incognito'] },
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
