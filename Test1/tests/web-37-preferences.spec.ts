// WEB-37 Preferences - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account from .env. Nothing is saved (changes are cancelled; registration and password changes are out of scope).
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { BrowserContext } from '@playwright/test'; // Type of a browser window (used for a saved session).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the header (profile dialog).
import { openHome } from '../pages/WebSite'; // Opens the homepage and waits for the movie list.
import { // Sign-in helpers (see pages/Account.ts):
  closeMessage, completeSignIn, messagePopup, myAccountLink, openAccountTab, openMyAccount, openSignInDialog, otpDialog,
  signIn, signInDialog, signOut, submitOtp, submitSignIn,
} from '../pages/Account';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

// Skip (instead of failing) when the test account is not set in .env / the CI secrets.
test.beforeEach(({ testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run the account tests.');
});

test('WEB-37 Preferences', async ({ page, step, testConfig }) => {
  // The PREFERENCES form (the header menu has its own "EXPERIENCE" link, so checks stay inside the form).
  const prefs = page.locator('div').filter({ visible: true }).filter({ hasText: /choose your preference/i }).filter({ has: page.locator('select') }).last();
  const ageRating = prefs.locator('input[type="checkbox"]'); // AGE RATING checkboxes (G, PG, 13+, 18+); styled, so not "visible".
  let saved: boolean[] = []; // Saved state of those checkboxes.
  await step('Sign in and open My Account > PREFERENCES', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    await openMyAccount(page); // My Account.
    await openAccountTab(page, 'PREFERENCES'); // PREFERENCES tab.
    await expect(page.getByText(/choose your preference/i).first()).toBeVisible({ timeout: 30_000 }); // Its introduction.
  });

  await step('Check LOCATION, SEAT CATEGORY, SEAT TYPE, EXPERIENCE, AGE RATING and NOTIFICATIONS', async () => {
    for (const heading of ['LOCATION', 'SEAT CATEGORY', 'SEAT TYPE', 'EXPERIENCE', 'AGE RATING', 'NOTIFICATIONS']) {
      await expect.soft(prefs, `PREFERENCES should show ${heading}`).toContainText(new RegExp(heading, 'i')); // Each section.
    }
    await expect(prefs.locator('select').first()).toContainText(/cinescape 360/i); // Location list offers Cinescape 360.
    for (const option of ['Family', 'Bachelor', 'Standard', 'Premium', 'G', 'PG', '13+', '18+']) {
      await expect.soft(prefs.getByText(option, { exact: true }).first(), `PREFERENCES should offer "${option}"`).toBeVisible(); // Each option.
    }
    saved = await ageRating.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked)); // Remember the saved state.
  });

  await step('Change an age rating, click Cancel and check the saved choices are back', async () => {
    await prefs.getByText('18+', { exact: true }).click(); // Tick / untick 18+ (click its label; not saved).
    expect(await ageRating.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked)), 'The 18+ box should change').not.toEqual(saved);
    await prefs.getByRole('button', { name: /^cancel$/i }).click(); // Cancel.
    await openAccountTab(page, 'PROFILE'); // Leave the tab
    await openAccountTab(page, 'PREFERENCES'); // and come back.
    // Expected: Cancel throws the change away. Seen on UAT (30 Sep 2026): the unsaved 18+ tick stays on screen until the page is reloaded.
    await expect.soft.poll(async () => ageRating.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked)),
      { message: 'After Cancel, PREFERENCES should show the saved choices again (without reloading)', timeout: 20_000 }).toEqual(saved); // Given 20 s.
  });

  await step('Reload the page and check the saved choices did not change', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' }); // Fresh copy from the server.
    await openAccountTab(page, 'PREFERENCES'); // PREFERENCES tab.
    await expect(page.getByText(/choose your preference/i).first()).toBeVisible({ timeout: 30_000 }); // Its introduction.
    await expect.poll(async () => ageRating.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked)),
      { message: 'Cancel must not save the change', timeout: 20_000 }).toEqual(saved); // Same as saved.
  });
});
