// WEB-10 Session stays signed in after closing the browser - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account from .env. Nothing is saved (changes are cancelled; registration and password changes are out of scope).
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { devices, type BrowserContext } from '@playwright/test'; // Browser settings, and the type of a browser window (saved session).
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

test('WEB-10 Session stays signed in after closing the browser', async ({ page, browser, step, testConfig }) => {
  let savedSession: Awaited<ReturnType<BrowserContext['storageState']>> | undefined; // Cookies + stored data of the browser.
  await step('Sign in', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    savedSession = await page.context().storageState(); // What the browser keeps when it is closed.
  });

  await step('Close the browser, reopen the site and check the user is still signed in', async () => {
    const reopened = await browser.newContext({ ...devices['Desktop Chrome'], storageState: savedSession }); // A new Chrome window (same settings as the test) with the same saved data.
    const again = await reopened.newPage(); // Open a tab in it.
    await openHome(again, testConfig.urls.home); // Load the homepage.
    await expect(myAccountLink(again), 'The user should still be signed in after reopening the browser').toBeAttached({ timeout: 30_000 });
    await reopened.close(); // Close that window.
  });

  await step('Sign out, reopen the site and check the user is signed out', async () => {
    await signOut(page); // MENU > LOGOUT in the original window.
    const afterSignOut = await page.context().storageState(); // Saved data after signing out.
    const reopened = await browser.newContext({ ...devices['Desktop Chrome'], storageState: afterSignOut }); // Reopen Chrome with that data.
    const again = await reopened.newPage();
    await openHome(again, testConfig.urls.home); // Load the homepage.
    await expect(myAccountLink(again), 'After signing out, reopening the browser should stay signed out').toHaveCount(0);
    await reopened.close();
  });
});
