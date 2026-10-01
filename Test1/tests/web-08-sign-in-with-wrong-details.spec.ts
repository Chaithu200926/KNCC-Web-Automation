// WEB-08 Sign in with wrong details - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
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

test('WEB-08 Sign in with wrong details', async ({ page, step, testConfig }) => {
  const message = messagePopup(page); // The site's message pop-up.

  await step('Sign in with an email that is not registered and check the message', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await submitSignIn(page, 'nobody.kncc.test@example.invalid', 'Wrong@12345'); // Unknown email.
    await expect(message).toContainText('Please enter a valid username and password.', { timeout: 30_000 }); // Clear message.
    await closeMessage(page); // OK.
    await expect(myAccountLink(page)).toHaveCount(0); // Still signed out.
  });

  await step('Sign in with a wrong password and check the same message', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await submitSignIn(page, testConfig.credentials.username, `${testConfig.credentials.password}-wrong`); // One wrong attempt only.
    await expect(message).toContainText('Please enter a valid username and password.', { timeout: 30_000 }); // Same message.
    await closeMessage(page); // OK.
    await expect(myAccountLink(page)).toHaveCount(0); // Still signed out.
  });

  await step('Enter a wrong OTP and check the message, then Clear', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await submitSignIn(page, testConfig.credentials.username, testConfig.credentials.password); // Right email and password.
    const wrongOtp = testConfig.credentials.pin.split('').map((digit) => String((Number(digit) + 1) % 10)).join(''); // Every digit +1.
    await submitOtp(page, wrongOtp); // Wrong OTP.
    await expect(message).toContainText('Otp entered is invalid', { timeout: 30_000 }); // Clear message.
    await closeMessage(page); // OK.
    await otpDialog(page).getByRole('button', { name: /clear/i }).click(); // Clear the boxes.
    await expect.poll(() => otpDialog(page).locator('input[type="tel"]').evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).value).join('')))
      .toBe(''); // All boxes are empty.
    await expect(myAccountLink(page)).toHaveCount(0); // Not signed in yet.
  });

  await step('Enter the correct OTP and check the user is signed in', async () => {
    await submitOtp(page, testConfig.credentials.pin); // Correct OTP.
    await expect(myAccountLink(page)).toBeAttached({ timeout: 30_000 }); // Signed in.
    await signOut(page); // Sign out again.
  });

  await step('Submit SIGN IN with Email and Password empty and check the form stays usable', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await signInDialog(page).getByRole('button', { name: /^sign in$/i }).last().click(); // Sign in with empty fields.
    // Expected: "required" messages. Seen on UAT (30 Sep 2026): the form disappears and an empty dialog stays on screen.
    await expect.soft(page.locator('input[name="email"]:visible'), 'The sign-in form should stay visible with "required" messages')
      .toBeVisible({ timeout: 15_000 }); // Given 15 s to re-draw.
  });
});
