// WEB-12 Edit profile - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
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

test('WEB-12 Edit profile', async ({ page, step, testConfig }) => {
  const firstName = page.locator('input[type="text"]:visible').nth(1); // Second text box on PROFILE = First Name.
  let original = ''; // The saved first name.
  await step('Sign in and open My Account > PROFILE', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    await openMyAccount(page); // My Account.
    await openAccountTab(page, 'PROFILE'); // PROFILE tab.
    await expect.poll(async () => firstName.inputValue(), { timeout: 20_000 }).not.toBe(''); // Wait for the saved details.
    original = await firstName.inputValue(); // Remember the saved first name.
  });

  await step('Click Edit, change the first name, and check Save and Cancel are offered', async () => {
    await page.getByText(/^edit$/i).first().click(); // Edit.
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible(); // Save is offered.
    await expect(page.getByRole('button', { name: /^cancel$/i })).toBeVisible(); // Cancel is offered.
    await firstName.fill(`${original}Edited`); // Change the first name (not saved).
  });

  await step('Click Cancel and check the saved first name is back', async () => {
    await page.getByRole('button', { name: /^cancel$/i }).click(); // Cancel: nothing is saved.
    await openAccountTab(page, 'HISTORY'); // Leave the tab
    await openAccountTab(page, 'PROFILE'); // and come back.
    await expect.poll(async () => firstName.inputValue(), { timeout: 20_000 }).toBe(original); // Original value.
  });
});
