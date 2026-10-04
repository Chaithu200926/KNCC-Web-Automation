// WEB-35 Booking history - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
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

test('WEB-35 Booking history', async ({ page, step, testConfig }) => {
  // History cards; food-only orders have no seats, so the first ticket booking (with seats) is checked.
  const ticketCard = page.locator('.movie_section').filter({ visible: true }).filter({ hasText: /seats/i }).first();
  await step('Sign in and open My Account > HISTORY', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    await openMyAccount(page); // My Account.
    await openAccountTab(page, 'HISTORY'); // HISTORY tab.
    await expect(page.getByText(/bookings history/i).first()).toBeVisible({ timeout: 30_000 }); // "BOOKINGS HISTORY".
  });

  await step('Check each booking shows status, location, Booking ID, date & time, screen, seats and category', async () => {
    await expect(ticketCard).toBeVisible({ timeout: 30_000 }); // At least one ticket booking.
    for (const label of [/cancelled|confirmed|booked|completed/i, /location/i, /booking id\s*\w{5,}/i, /date & time/i, /screen/i, /seats/i, /category/i]) {
      await expect.soft(ticketCard, `History card should show ${label}`).toContainText(label); // Each detail.
    }
  });

  await step('Open View Details and check the ticket and transaction details', async () => {
    await ticketCard.getByText(/^view details$/i).click(); // View Details on that booking.
    await expect(page.getByText(/^close details$/i).filter({ visible: true }).first()).toBeVisible(); // It expands (Close Details).
    const details = page.locator('div').filter({ visible: true }).filter({ has: page.getByText(/^close details$/i) }).filter({ hasText: /grand total/i }).last(); // Expanded block.
    for (const label of [/ticket details/i, /transaction details/i, /track id/i, /payment mode/i, /ticket price\s*KWD/i, /grand total/i]) {
      await expect.soft(details, `Details should show ${label}`).toContainText(label);
    }
    await page.getByText(/^close details$/i).filter({ visible: true }).first().click(); // Close Details.
  });
});
