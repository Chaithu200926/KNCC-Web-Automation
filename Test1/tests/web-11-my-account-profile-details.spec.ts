// WEB-11 My Account profile details - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
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

test('WEB-11 My Account profile details', async ({ page, step, testConfig }) => {
  await step('Sign in and open My Account', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    await openMyAccount(page); // Header > My Account.
  });

  await step('Check "Welcome back", the name, the wallet balance and the five tabs', async () => {
    const header = page.locator('.account-left').filter({ visible: true }).locator('xpath=..'); // Greeting + name block (desktop copy).
    await expect(header).toContainText(/welcome back\s*\S+/i); // "Welcome back <first name>".
    await expect(page.getByText(/wallet balance\s*KWD\s*[\d,.]+/i).filter({ visible: true }).first()).toBeVisible(); // Wallet balance in KWD.
    for (const tab of ['PROFILE', 'BOOKINGS', 'PREFERENCES', 'RECHARGE WALLET', 'HISTORY']) {
      await expect(page.getByText(new RegExp(`^${tab}$`, 'i')).filter({ visible: true }).first()).toBeVisible(); // Each tab (desktop copy).
    }
  });

  await step('Check PROFILE shows the account details', async () => {
    await openAccountTab(page, 'PROFILE'); // PROFILE tab.
    for (const label of ['User Name', 'First Name', 'Last Name', 'Email', 'Mobile', 'Date Of Birth', 'Gender', 'Receive Promotional Emails', 'Receive Mobile Notifications']) {
      await expect.soft(page.getByText(new RegExp(`^${label}$`, 'i')).filter({ visible: true }).first(), `PROFILE should show "${label}"`).toBeVisible(); // Each field label.
    }
    const values = await page.locator('input[type="text"]:visible, input[type="email"]:visible').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect.soft(values.includes(testConfig.credentials.username), 'PROFILE should show the account email').toBe(true); // Right account.
    expect.soft(values.filter(Boolean).length, 'Name, email and mobile should be filled in').toBeGreaterThanOrEqual(4); // Filled fields.
  });
});
