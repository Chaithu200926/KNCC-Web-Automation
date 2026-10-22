// WEB-12 Edit profile - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account from .env for Edit / Cancel (nothing saved there). Saving is checked on a NEW user registered
// for this run (first name, Date of Birth, email and mobile), so the provided test account is never changed.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { BrowserContext } from '@playwright/test'; // Type of a browser window (used for a saved session).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { HomePage } from './pages/HomePage'; // Page object for the header (profile dialog).
import { openHome } from './pages/WebSite'; // Opens the homepage and waits for the movie list.
import { // Sign-in helpers (see pages/Account.ts):
  closeMessage, completeSignIn, messagePopup, myAccountLink, openAccountTab, openMyAccount, openSignInDialog, otpDialog,
  signIn, signInDialog, signOut, submitOtp, submitSignIn, visibleFieldValues,
} from './pages/Account';
import { pickDateOfBirth, registerNewUser } from './pages/NewUser'; // Registers a new UAT user for the save checks.

test.describe.configure({ timeout: 360_000 }); // Up to 6 minutes (two accounts, a registration and reloads on the slow UAT site).

// Skip (instead of failing) when the test account is not set in .env / the CI secrets.
test.beforeEach(({ testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run the account tests.');
});

test('WEB-12 Edit profile', async ({ page, step, testConfig }, testInfo) => {
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

  const stamp = Date.now().toString(); // Makes the new email and mobile unique.
  const changes = { firstName: 'Autoedit', dateOfBirth: '15-06-1990', email: `kncc.autotest.${stamp}.edited@example.com`, mobile: `6${stamp.slice(-7)}` };
  let user = { email: '', password: '', mobile: '' }; // The new user.
  await step('Set-up: sign out, register a new user for this test and sign in with it', async () => {
    await openHome(page, testConfig.urls.home);
    await signOut(page); // MENU > LOGOUT (test account).
    ({ user } = await registerNewUser(page, testConfig.urls.home, testConfig.newUserOtp)); // New user, signed in.
    testInfo.annotations.push({ type: 'new user', description: user.email });
    await openHome(page, testConfig.urls.home); // My Account opens only after signing in again (seen on UAT, 1 Oct 2026).
    await signOut(page);
    await signIn(page, { username: user.email, password: user.password, pin: testConfig.newUserOtp });
    await openMyAccount(page);
    await openAccountTab(page, 'PROFILE');
    await expect.poll(() => visibleFieldValues(page), { timeout: 20_000 }).toContain(user.email); // Its details are shown.
  });

  await step('Click Edit, change the first name, Date of Birth, email and mobile, and click Save', async () => {
    await page.getByText(/^edit$/i).first().click(); // Edit.
    const texts = page.locator('input[type="text"]:visible'); // User Name, First Name, Last Name, ..., Mobile.
    await texts.nth(1).fill(changes.firstName); // First Name.
    await pickDateOfBirth(page, page.locator('.react-datepicker__input-container input').filter({ visible: true }).first(), changes.dateOfBirth); // Date of Birth (Pre-UAT: picked in the calendar).
    await page.locator('input[type="email"]:visible').first().fill(changes.email); // Email.
    const mobileIndex = (await texts.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).value))).indexOf(user.mobile);
    expect(mobileIndex, 'The mobile box should show the current number').toBeGreaterThanOrEqual(0);
    await texts.nth(mobileIndex).fill(changes.mobile); // Mobile.
    await page.getByRole('button', { name: /^save$/i }).click(); // Save.
    // A changed email or mobile may need an OTP: enter the UAT OTP if the site asks for one.
    const otpBoxes = page.locator('[role="dialog"]:visible input[maxlength="1"]');
    if (await otpBoxes.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      const count = await otpBoxes.count();
      for (let index = 0; index < count; index += 1) await otpBoxes.nth(index).fill(testConfig.newUserOtp[index % 6]);
      await page.locator('[role="dialog"]:visible').getByRole('button', { name: /submit|verify|confirm/i }).first().click();
    }
    const message = page.locator('.swal-overlay--show-modal .swal-modal');
    if (await message.isVisible({ timeout: 10_000 }).catch(() => false)) {
      testInfo.annotations.push({ type: 'profile save message', description: (await message.innerText()).replace(/\s+/g, ' ').trim() });
      await message.getByRole('button').first().click(); // OK.
    }
  });

  await step('Reload My Account > PROFILE and check every change was kept', async () => {
    // Seen on UAT (11 Oct 2026): Save sends nothing to the server, so none of the changes are kept.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openAccountTab(page, 'PROFILE');
    await expect.poll(async () => (await visibleFieldValues(page)).some((value) => value.includes('@')), { timeout: 30_000 }).toBe(true); // Loaded (an email is shown).
    const values = await visibleFieldValues(page);
    const shownDate = changes.dateOfBirth.split('-').reverse().join('-'); // "1990-06-15".
    expect.soft(values, 'The new first name should be saved').toContain(changes.firstName);
    expect.soft(values.some((value) => value.includes(shownDate) || value.includes(changes.dateOfBirth)), 'The new Date of Birth should be saved').toBe(true);
    expect.soft(values, 'The new email should be saved').toContain(changes.email);
    expect.soft(values, 'The new mobile should be saved').toContain(changes.mobile);
    await expect.soft(page.locator('nav.header-nav'), 'The header should greet the new first name').toContainText(changes.firstName);
  });
});
