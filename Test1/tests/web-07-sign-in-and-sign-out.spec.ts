// WEB-07 Sign in and sign out - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
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

test('WEB-07 Sign in and sign out', async ({ page, step, testConfig }) => {
  await step('Open SIGN IN and check its fields and links', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    const dialog = signInDialog(page); // The dialog.
    for (const text of [/email/i, /password/i, /forgot password\?/i, /not registered\?/i]) await expect(dialog.getByText(text).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^sign in$/i }).last()).toBeVisible(); // Sign in button.
  });

  await step('Sign in with the test account email, password and OTP', async () => {
    await completeSignIn(page, testConfig.credentials); // Email + password, then the email OTP.
  });

  await step('Check My Account opens with "Welcome back" and the wallet balance', async () => {
    await openMyAccount(page); // Header > My Account.
    await expect(page.getByText(/wallet balance\s*KWD\s*[\d,.]+/i).filter({ visible: true }).first()).toBeVisible(); // "Wallet Balance KWD 198.500".
  });

  await step('Sign out with MENU > LOGOUT and check the user is signed out', async () => {
    await signOut(page); // MENU > LOGOUT.
    const token = await page.evaluate(() => window.localStorage.getItem('token')); // Session token kept by the site.
    expect(token, 'The session token should be removed after sign-out').toBeFalsy(); // Gone.
    await page.locator('nav.header-nav .user-profile:visible').first().click(); // The profile icon
    await expect(signInDialog(page)).toBeVisible(); // asks to sign in again.
  });
});
