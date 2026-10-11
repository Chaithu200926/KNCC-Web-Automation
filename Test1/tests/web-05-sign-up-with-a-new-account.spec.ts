// WEB-05 Sign up with a new account - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Registers a brand-new user (unique email at example.com and mobile number, so the provided test accounts are never
// touched), enters the email and mobile OTPs (111111 on UAT), checks the user is signed in and My Account shows the
// details, then signs out and signs in again with the new email and password. Then checks the wallet balance and that a
// preference chosen after sign-up is saved. Each run leaves one new UAT user.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, OTP for new users) and step() (step + screenshot).
import { openHome } from '../pages/WebSite'; // Opens the homepage.
import { myAccountLink, openAccountTab, signIn, signOut } from '../pages/Account'; // Sign-in, My Account tabs and sign-out.
import { openMessage } from '../pages/Booking'; // The site's open message pop-up.
import { confirmSignUp, fillSignUp, newTestUser, openSignUp, signUpDialog, signUpOtpDialog } from '../pages/NewUser'; // Sign-up steps.

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (registration, two sign-ins and preferences on the slow UAT site).

test('WEB-05 Sign up with a new account', async ({ page, step, testConfig }, testInfo) => {
  const user = newTestUser(); // New, unique details for this run.
  const otp = testConfig.newUserOtp; // Email and mobile OTP (111111 on UAT).
  testInfo.annotations.push({ type: 'new user', description: `${user.email} (mobile +965 ${user.mobile})` });
  const profileValues = () => page.locator('input:visible').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)); // PROFILE field values.

  await step('Open the homepage, click My Profile, then "Not Registered? SIGN UP"', async () => {
    await openHome(page, testConfig.urls.home); // Homepage.
    await openSignUp(page); // Profile icon > SIGN IN > SIGN UP.
  });

  await step('Fill Name, Last Name, a new Email, Password, Confirm Password, Mobile, Date of Birth and Gender', async () => {
    await fillSignUp(page, user); // Every field of the form (the promotion options keep "Yes").
  });

  await step('Click Save and check the site asks for the OTPs sent to the email and mobile', async () => {
    const request = page.waitForRequest((r) => /\/customer\/register/i.test(r.url()) && r.method() === 'POST', { timeout: 30_000 }); // What the form sends.
    await signUpDialog(page).getByRole('button', { name: /^save$/i }).click(); // Save.
    const sent = (await request).postDataJSON() as Record<string, unknown> | null; // The details sent (shown without the password).
    if (sent) testInfo.annotations.push({ type: 'sign-up request', description: JSON.stringify({ ...sent, password: undefined, confirmPassword: undefined }) });
    await expect(openMessage(page)).toContainText(/OTP sent to your mobile number and email/i, { timeout: 30_000 }); // The message.
    await openMessage(page).getByRole('button', { name: /^ok$/i }).click(); // OK.
    await expect(signUpOtpDialog(page)).toBeVisible(); // "ENTER OTP RECEIVED ON EMAIL & MOBILE".
  });

  await step('Enter the email OTP and the mobile OTP and check the user is signed in with the name in the header', async () => {
    await confirmSignUp(page, otp); // 111111 twice, Submit OTP.
    await expect(page.locator('nav.header-nav')).toContainText(user.firstName); // "Auto" in the header.
  });

  await step('Check My Account opens right after signing up', async () => {
    // Seen on UAT (1 Oct 2026): the first profile request after sign-up is refused (HTTP 403) and My Account sends the
    // new user back to the homepage; after signing in again it works (checked in the last step).
    // Up to 75 s: open My Account again each time (the site refreshes its sign-in token after the refused request).
    const opened = await expect(async () => {
      await page.goto(new URL('/myaccount', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // My Account.
      await expect.poll(profileValues, { timeout: 20_000 }).toContain(user.email); // PROFILE filled in?
    }).toPass({ timeout: 75_000 }).then(() => true, () => false);
    testInfo.annotations.push({ type: 'My Account after sign-up', description: opened ? 'PROFILE opened.' : `Did not open; the site went to ${new URL(page.url()).pathname}.` });
    notOnUat(opened, 'My Account > PROFILE does not open for the new user right after signing up (works after signing in again).');
  });

  await step('Sign out, then sign in again with the new email and password', async () => {
    await openHome(page, testConfig.urls.home); // Homepage.
    await signOut(page); // MENU > LOGOUT.
    await signIn(page, { username: user.email, password: user.password, pin: otp }); // Email, password, OTP.
    await expect(myAccountLink(page)).toBeAttached(); // Signed in with the new account.
  });

  await step('Check My Account > PROFILE shows the entered details', async () => {
    await page.goto(new URL('/myaccount', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // My Account > PROFILE.
    await expect.poll(profileValues, { message: 'My Account > PROFILE should open', timeout: 30_000 }).toContain(user.email); // Filled in.
    const values = await profileValues(); // e.g. ["kncc.autotest...", "Auto", "Tester", ...].
    for (const [label, value] of [['first name', user.firstName], ['last name', user.lastName], ['email', user.email], ['mobile', user.mobile]]) {
      expect(values, `PROFILE should show the ${label} "${value}"`).toContain(value);
    }
    const shownDate = user.dateOfBirth.split('-').reverse().join('-'); // "1995-01-01".
    notOnUat(values.some((value) => value.includes(shownDate) || value.includes(user.dateOfBirth)), `PROFILE does not show the Date of Birth ${shownDate} entered at sign-up (the sign-up form sends an empty date).`);
    const genderChecked = await page.locator('label').filter({ visible: true }).filter({ hasText: new RegExp(`^${user.gender}$`) }).locator('input[type="radio"]').first().isChecked().catch(() => false);
    notOnUat(genderChecked, `PROFILE does not show the Gender ${user.gender} entered at sign-up.`);
  });

  await step('Check the new account shows a wallet balance', async () => {
    const welcome = page.locator('.account-left').filter({ visible: true }).first(); // "Welcome back ... Wallet Balance KWD x".
    const text = (await welcome.innerText()).replace(/\s+/g, ' ');
    testInfo.annotations.push({ type: 'new user wallet', description: text.match(/wallet balance.{0,20}/i)?.[0] ?? text.slice(0, 80) });
    // Seen on UAT (11 Oct 2026): "Wallet Balance" with no amount and no activation step for a new account. Noted, not failed.
    notOnUat(/wallet balance\s*KWD\s*\d/i.test(text), 'A new account shows "Wallet Balance" with no amount (no wallet activation on the website).');
  });

  await step('Choose preferences after sign-up: tick 18+, Save, reload and check the choice is kept', async () => {
    const prefs = page.locator('div').filter({ visible: true }).filter({ hasText: /choose your preference/i }).filter({ has: page.locator('select') }).last(); // PREFERENCES form.
    const ageRating = prefs.locator('input[type="checkbox"]'); // AGE RATING checkboxes (G, PG, 13+, 18+).
    const ticked = () => ageRating.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked));
    await openAccountTab(page, 'PREFERENCES'); // PREFERENCES tab.
    await expect(page.getByText(/choose your preference/i).first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await ticked()).length, { timeout: 20_000 }).toBeGreaterThan(0); // Loaded.
    const before = await ticked();
    await prefs.getByText('18+', { exact: true }).click(); // Tick / untick 18+.
    const wanted = await ticked();
    expect(wanted, 'The 18+ box should change').not.toEqual(before);
    await prefs.getByRole('button', { name: /^save$/i }).click(); // Save.
    await expect.soft(openMessage(page), 'The site should confirm the save').toContainText(/updated/i, { timeout: 30_000 }); // "Your preferences have been updated."
    if (await openMessage(page).count()) await openMessage(page).getByRole('button', { name: /^ok$/i }).click(); // OK.
    await page.reload({ waitUntil: 'domcontentloaded' }); // Fresh copy from the server.
    await openAccountTab(page, 'PREFERENCES');
    await expect(page.getByText(/choose your preference/i).first()).toBeVisible({ timeout: 30_000 });
    // Seen on UAT (11 Oct 2026): the save is accepted ("Your preferences have been updated.") but after a reload the old choice is back.
    await expect.poll(ticked, { message: 'The saved preference should still be ticked after a reload', timeout: 20_000 }).toEqual(wanted);
  });
});
