// WEB-13 Change password - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Registers a new user for this run (the provided test accounts are never touched), then in My Account > PROFILE >
// Edit Password checks a wrong current password and a mismatch are refused, changes the password, checks the new one
// works and the old one does not, and changes it back. Each run leaves one new UAT user.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, OTP for new users) and step() (step + screenshot).
import { myAccountLink, openSignInDialog, signIn, signOut, submitSignIn } from '../pages/Account'; // Sign-in steps.
import { closeOpenMessage, openMessage } from '../pages/Booking'; // The site's open message pop-up.
import { changePasswordDialog, newTestUser, openChangePassword, registerNewUser, submitChangePassword } from '../pages/NewUser'; // New user steps.
import { appears, openHome } from '../pages/WebSite'; // Opens the homepage; waits for a message.

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (registration and several sign-ins on the slow UAT site).

test('WEB-13 Change password', async ({ page, step, testConfig }, testInfo) => {
  let user = newTestUser(); // The new user for this run (set in the set-up step).
  const otp = testConfig.newUserOtp; // Email / mobile OTP (111111 on UAT).
  const newPassword = 'Auto@Kncc2028'; // The changed password.
  // Opens My Account > PROFILE and the "Change Password" dialog.
  const openDialog = async () => {
    await page.goto(new URL('/myaccount', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // My Account > PROFILE.
    await openChangePassword(page); // Edit Password.
  };

  await step('Set-up: register a new user for this test, sign out and sign in again', async () => {
    const registered = await registerNewUser(page, testConfig.urls.home, otp); // SIGN UP, Save, OTPs; signed in.
    user = registered.user;
    testInfo.annotations.push({ type: 'new user', description: user.email });
    if (registered.refused.length) testInfo.annotations.push({ type: 'sign-up refused first', description: registered.refused.join('; ') });
    // Right after signing up My Account does not open on UAT (WEB-05), so the new user signs in again first.
    await signOut(page); // MENU > LOGOUT.
    await signIn(page, { username: user.email, password: user.password, pin: otp }); // Email, password, OTP.
  });

  await step('On My Account > PROFILE click Edit Password; enter a wrong current password and check the error', async () => {
    await expect(openDialog).toPass({ timeout: 90_000 }); // My Account > Edit Password (tried again if the page is slow).
    await submitChangePassword(page, 'Wrong@1234', newPassword); // Wrong current password.
    await expect(openMessage(page), 'A wrong current password should be refused').toContainText(/old password is wrong/i, { timeout: 30_000 });
    await closeOpenMessage(page); // OK.
  });

  await step('Enter a new password and a different confirmation and check the mismatch error', async () => {
    await submitChangePassword(page, user.password, newPassword, 'Auto@Kncc9999'); // Confirmation differs.
    await expect(openMessage(page), 'A mismatch should be refused').toContainText(/passwords do not match/i, { timeout: 15_000 });
    await closeOpenMessage(page); // OK.
  });

  await step('Enter the correct current password and a valid new password, Proceed, and check the change is accepted', async () => {
    const answer = page.waitForResponse((r) => /changepassword/i.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 }); // The change request.
    await submitChangePassword(page, user.password, newPassword); // Correct current password.
    expect((await answer).ok(), 'The site should accept the change').toBe(true);
    const confirmed = await appears(openMessage(page), 10_000); // A success message within 10 s?
    testInfo.annotations.push({ type: 'after the change', description: confirmed ? `Message: ${(await openMessage(page).innerText()).replace(/\s+/g, ' ')}` : 'No message is shown.' });
    notOnUat(confirmed, 'Change Password: no success message is shown (the change is accepted and the user is signed out).');
    if (confirmed) await closeOpenMessage(page); // OK.
    await expect(changePasswordDialog(page), 'The Change Password dialog should close').toBeHidden({ timeout: 15_000 });
  });

  await step('Sign out and sign in with the new password; check the old one fails', async () => {
    await openHome(page, testConfig.urls.home); // Homepage.
    const stillSignedIn = await myAccountLink(page).count() > 0; // Does the change sign the user out?
    testInfo.annotations.push({ type: 'session after the change', description: stillSignedIn ? 'Still signed in.' : 'Signed out by the change.' });
    if (stillSignedIn) await signOut(page); // MENU > LOGOUT.
    await openSignInDialog(page); // Profile icon > SIGN IN.
    await submitSignIn(page, user.email, user.password); // The old password.
    await expect(openMessage(page), 'The old password should be refused').toContainText(/valid username and password/i, { timeout: 30_000 });
    await closeOpenMessage(page); // OK.
    await openHome(page, testConfig.urls.home); // Fresh page.
    await signIn(page, { username: user.email, password: newPassword, pin: otp }); // The new password, OTP.
    await expect(myAccountLink(page)).toBeAttached(); // Signed in.
  });

  await step('Change the password back', async () => {
    await expect(openDialog).toPass({ timeout: 90_000 }); // My Account > Edit Password.
    const answer = page.waitForResponse((r) => /changepassword/i.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 });
    await submitChangePassword(page, newPassword, user.password); // Back to the first password.
    expect((await answer).ok(), 'The site should accept the change back').toBe(true);
    await expect(changePasswordDialog(page)).toBeHidden({ timeout: 15_000 });
  });
});
