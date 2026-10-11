// WEB-06 Sign up form validation - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account from .env (its email and mobile are tried again at sign-up, which must be refused). Nothing is
// registered: every form is invalid or refused before the OTP step.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { BrowserContext } from '@playwright/test'; // Type of a browser window (used for a saved session).
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the header (profile dialog).
import { openHome } from '../pages/WebSite'; // Opens the homepage and waits for the movie list.
import { // Sign-in helpers (see pages/Account.ts):
  closeMessage, completeSignIn, messagePopup, myAccountLink, openAccountTab, openMyAccount, openSignInDialog, otpDialog,
  readAccountMobile, signIn, signInDialog, signOut, submitOtp, submitSignIn,
} from '../pages/Account';
import { openMessage } from '../pages/Booking'; // The site's open message pop-up.
import { fillSignUp, newTestUser, openSignUp } from '../pages/NewUser'; // Sign-up form helpers.

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (the form checks, a sign-in and two sign-up tries).

// Skip (instead of failing) when the test account is not set in .env / the CI secrets.
test.beforeEach(({ testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run the account tests.');
});

test('WEB-06 Sign up form validation', async ({ page, step, testConfig }, testInfo) => {
  const home = new HomePage(page); // Header helper.
  const signUp = page.locator('[role="dialog"]:visible').filter({ hasText: /sign up/i }).last(); // The SIGN UP dialog.
  const save = signUp.getByRole('button', { name: /^save$/i }); // Its Save button.

  await step('Open SIGN UP from the profile icon', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await openSignInDialog(page); // Profile icon > SIGN IN dialog.
    await signInDialog(page).getByText(/^sign up$/i).click(); // "Not Registered? SIGN UP".
    await expect(signUp.locator('input[name="firstname"]')).toBeVisible(); // The SIGN UP form is shown.
  });

  await step('Click Save with every field empty and check each required field shows an error', async () => {
    await save.click(); // Save with nothing filled in (nothing can be created).
    for (const message of [ // The site's own messages for the required fields:
      'The first name field is required.', 'The last name field is required.', 'The email field is required.',
      'The password field is required.', 'The confirm password field is required.', 'The mobile field is required.',
    ]) await expect.soft(signUp.getByText(message)).toBeVisible();
    // Date of Birth is marked "*" (required) too; UAT has no message for it, so that is noted, not failed.
    notOnUat(await signUp.getByText(/date of birth.*required|required.*date of birth/i).isVisible(), 'Empty Date of Birth: no "required" message.');
  });

  await step('Enter an invalid email, a too-short mobile and different passwords, and check the errors', async () => {
    await signUp.locator('input[name="firstname"]').fill('Test'); // A first name.
    await signUp.locator('input[type="email"]').first().fill('abc@'); // Invalid email.
    await signUp.locator('input[name="password"]').fill('Abcd@1234'); // Password
    await signUp.locator('input[name="con-password"]').fill('Abcd@9999'); // and a different confirmation.
    await signUp.locator('input[name="mobile"]').fill('123'); // A mobile number with too few digits.
    await save.click(); // Save (the form is invalid, so nothing is created).
    await expect.soft(signUp.getByText('The email must be a valid email address.')).toBeVisible(); // Email error.
    await expect.soft(signUp.getByText('Passwords do not match')).toBeVisible(); // Mismatch error.
    // UAT shows no message for a too-short mobile number (8 Oct 2026); noted, not failed. The form must still not be sent.
    notOnUat(await expect(signUp.getByText(/mobile/i).filter({ hasText: /valid|digits|invalid|must/i })).toBeVisible().then(() => true, () => false),
      'A 3-digit mobile number shows no error message.');
    await expect(signUp.locator('input[name="firstname"]'), 'The invalid form must not be accepted (SIGN UP stays open)').toBeVisible(); // Not sent.
  });

  await step('Check "Have an Account? Sign in" returns to SIGN IN', async () => {
    await signUp.getByRole('link', { name: /^sign in$/i }).click({ timeout: 15_000 }); // "Have an Account? Sign in".
    await expect(signInDialog(page)).toBeVisible(); // Back to the SIGN IN form.
    await home.closeProfile(); // Close the dialog.
  });

  let accountMobile = ''; // The test account's mobile number (read from its PROFILE).
  await step('Sign in, note the test account mobile number, and sign out', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    accountMobile = await readAccountMobile(page); // My Account > PROFILE.
    await openHome(page, testConfig.urls.home);
    await signOut(page); // MENU > LOGOUT.
  });

  // Signing up again with details that are already registered must be refused at Save (before any OTP).
  // Seen on UAT (11 Oct 2026): the email gets "Email address or Mobile number already registered"; the mobile gets
  // only "Something went wrong!" (the outcome is right, the message is not clear).
  for (const [which, clearMessage] of [['email', true], ['mobile', false]] as const) {
    await step(`Sign up with the ${which} of the test account and check it is refused`, async () => {
      const user = newTestUser(); // New details, except the one already registered:
      if (which === 'email') user.email = testConfig.credentials.username; else user.mobile = accountMobile;
      await openHome(page, testConfig.urls.home); // Fresh page.
      await openSignUp(page); // Profile icon > SIGN IN > SIGN UP.
      await fillSignUp(page, user); // Every field.
      await save.click(); // Save.
      await expect(openMessage(page), 'The site should answer with a message').toContainText(/\w{3,}/, { timeout: 30_000 });
      const message = (await openMessage(page).innerText()).replace(/\s+/g, ' ').trim(); // e.g. "Email address ... already registered OK".
      testInfo.annotations.push({ type: `${which} already used`, description: message });
      expect(message, `An already registered ${which} must be refused (no OTP step)`).not.toMatch(/OTP sent/i);
      const says = /already (?:registered|used|exists?)/i.test(message);
      if (clearMessage) expect.soft(says, `The message should say the ${which} is already registered`).toBe(true);
      else notOnUat(says, `An already registered ${which}: the message is "${message.replace(/\s*OK$/, '')}", not that the ${which} is already registered.`);
      await openMessage(page).getByRole('button', { name: /^ok$/i }).click(); // OK.
      await expect(signUp.locator('input[name="firstname"]'), 'SIGN UP should stay open (nothing registered)').toBeVisible();
    });
  }
});
