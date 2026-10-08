// WEB-09 Forgot password - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Registers a new user for this run (the provided test accounts are never touched), then resets its password with
// Forgot Password? and the emailed OTP (111111 on UAT), checks the new password works and the old one does not, and
// checks an unregistered email is refused. Each run leaves one new UAT user.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, OTP for new users) and step() (step + screenshot).
import { myAccountLink, openSignInDialog, signIn, signInDialog, signOut, submitSignIn } from '../pages/Account'; // Sign-in steps.
import { closeOpenMessage, openMessage } from '../pages/Booking'; // The site's open message pop-up.
import { forgotPasswordDialog, newTestUser, registerNewUser, resetPassword, resetPasswordDialog, startForgotPassword } from '../pages/NewUser'; // New user steps.
import { openHome } from '../pages/WebSite'; // Opens the homepage.

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (registration and several sign-ins on the slow UAT site).

test('WEB-09 Forgot password', async ({ page, step, testConfig }, testInfo) => {
  let user = newTestUser(); // The new user for this run (set in the set-up step).
  const otp = testConfig.newUserOtp; // Email / mobile OTP (111111 on UAT).
  const newPassword = 'Auto@Kncc2027'; // The password set with Forgot Password.

  await step('Set-up: register a new user for this test and sign out', async () => {
    const registered = await registerNewUser(page, testConfig.urls.home, otp); // SIGN UP, Save, OTPs; signed in.
    user = registered.user;
    testInfo.annotations.push({ type: 'new user', description: user.email });
    if (registered.refused.length) testInfo.annotations.push({ type: 'sign-up refused first', description: registered.refused.join('; ') });
    await signOut(page); // MENU > LOGOUT.
  });

  await step('Open SIGN IN, click "Forgot Password?", enter the email and click Continue', async () => {
    await startForgotPassword(page, user.email); // FORGOT PASSWORD > email > Continue.
    await expect(resetPasswordDialog(page), 'The OTP and new password step should open').toBeVisible({ timeout: 30_000 });
    await expect(resetPasswordDialog(page)).toContainText(/enter otp received on email/i); // "ENTER OTP RECEIVED ON EMAIL".
  });

  await step('Enter the emailed OTP and a new password twice, click Reset Password and check the success message', async () => {
    await resetPassword(page, otp, newPassword); // OTP, new password twice, Reset Password.
    await expect(openMessage(page), 'The site should confirm the change').toContainText(/passwords? changed succ/i, { timeout: 30_000 });
    const message = (await openMessage(page).innerText()).replace(/\s+/g, ' ').trim(); // e.g. "Passwords changed succefully OK".
    testInfo.annotations.push({ type: 'reset message', description: message });
    // The spelling of the message ("succefully" on UAT) is not part of the check.
    await closeOpenMessage(page); // OK.
    await expect(signInDialog(page), 'SIGN IN should open again').toBeVisible();
  });

  await step('Sign in with the new password', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await signIn(page, { username: user.email, password: newPassword, pin: otp }); // Email, new password, OTP.
    await expect(myAccountLink(page)).toBeAttached(); // Signed in.
    await signOut(page); // MENU > LOGOUT.
  });

  await step('Check the old password no longer works', async () => {
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await submitSignIn(page, user.email, user.password); // The old password.
    await expect(openMessage(page), 'The old password should be refused').toContainText(/valid username and password/i, { timeout: 30_000 });
    await closeOpenMessage(page); // OK.
    await expect(myAccountLink(page)).toHaveCount(0); // Not signed in.
  });

  await step('Repeat with an email that is not registered and check a clear message', async () => {
    await openHome(page, testConfig.urls.home); // Fresh page.
    await startForgotPassword(page, `kncc.autotest.unknown.${Date.now()}@example.com`); // Unknown email > Continue.
    await expect(openMessage(page), 'An unknown email should be refused').toContainText(/user not found/i, { timeout: 30_000 }); // "User not found, Please signup".
    await closeOpenMessage(page); // OK.
    await expect(forgotPasswordDialog(page), 'FORGOT PASSWORD should stay open').toBeVisible();
  });
});
