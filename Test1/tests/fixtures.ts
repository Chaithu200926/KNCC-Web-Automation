// Shared test setup for every spec in this folder: import `test` and `expect` from here instead of '@playwright/test'.
import { test as base, type Page } from '@playwright/test'; // Playwright's standard test function, extended below.
import { testConfig, TestConfig } from '../config/test-config'; // Site address, test account and card details (from .env).
import { cancelBookingInMyProfile, paidNotCancelled } from '../pages/Booking'; // Clean-up of paid bookings.

/** Runs a named test step, then attaches a screenshot with the same name (the dashboard shows it under that step). */
export type StepWithShot = (title: string, body: () => Promise<void>) => Promise<void>;

/** A second user in a separate browser (own cookies and sign-in), e.g. the second test account in WEB-29 and WEB-38. */
export interface SecondUser {
  page: Page; // The second user's page.
  shot: (title: string) => Promise<void>; // Attaches a screenshot of the second user's page, named "User 2: <title>".
}

export const test = base.extend<{ testConfig: TestConfig; step: StepWithShot; secondUser: SecondUser; cleanUpPaidBookings: void }>({
  // `testConfig`: gives each test the settings (e.g. testConfig.urls.home, testConfig.credentials.username).
  testConfig: async ({}, use) => {
    await use(testConfig);
  },
  // `step`: like test.step(), plus a screenshot of the page at the end of the step, named after the step.
  // The screenshots are saved as files (not inside the JSON report, which would grow to hundreds of MB for a full run).
  step: async ({ page }, use, testInfo) => {
    let count = 0; // Numbers the screenshot files.
    await use(async (title, body) => {
      await base.step(title, async () => { // Show the step by name in the report.
        await body(); // Run the step's actions and checks.
        const file = testInfo.outputPath(`step-${String(++count).padStart(2, '0')}.png`); // e.g. step-03.png.
        await page.screenshot({ path: file });
        await testInfo.attach(title, { path: file, contentType: 'image/png' }); // Screenshot for the dashboard.
      });
    });
  },
  // `secondUser`: only created for tests that ask for it; recorded on video like the first user's page.
  secondUser: async ({ browser, page }, use, testInfo) => {
    const context = await browser.newContext({ // A new private (incognito) context, like the test's own page.
      viewport: page.viewportSize(), serviceWorkers: 'block', recordVideo: { dir: testInfo.outputPath('user-2-video') },
    });
    const second = await context.newPage(); // User 2's page.
    let count = 0; // Numbers the screenshot files.
    await use({
      page: second,
      shot: async (title) => {
        const file = testInfo.outputPath(`user-2-${String(++count).padStart(2, '0')}.png`); // e.g. user-2-01.png.
        await second.screenshot({ path: file });
        await testInfo.attach(`User 2: ${title}`, { path: file, contentType: 'image/png' });
      },
    });
    const video = second.video(); // User 2's recording.
    await context.close(); // Close user 2's browser (the video is saved on close).
    if (video) await testInfo.attach('User 2 video', { path: await video.path(), contentType: 'video/webm' });
  },
  // `cleanUpPaidBookings` (runs for every test): afterwards, cancels any booking the test paid (payWithWallet /
  // payWithKnet) but did not cancel - e.g. because a check failed in between - so no paid booking is left in UAT.
  cleanUpPaidBookings: [async ({ page }, use, testInfo) => {
    await use(); // The test runs here.
    for (const bookingId of paidNotCancelled(page)) {
      try {
        await page.goto(new URL('/myaccount', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // My Account.
        await page.getByText(/^bookings$/i).first().click({ timeout: 60_000 }); // BOOKINGS tab.
        await cancelBookingInMyProfile(page, bookingId, /./); // Cancel Booking > Yes, I'm sure (found by its ID).
        testInfo.annotations.push({ type: 'clean-up', description: `Booking ${bookingId} was paid but not cancelled by the test; it was cancelled afterwards.` });
      } catch (error) {
        testInfo.annotations.push({ type: 'clean-up failed', description: `Booking ${bookingId} could not be cancelled automatically - cancel it by hand. ${String(error).slice(0, 200)}` });
      }
    }
  }, { auto: true, timeout: 120_000 }],
});

export { expect } from '@playwright/test'; // Playwright's checks, re-exported for convenience.
