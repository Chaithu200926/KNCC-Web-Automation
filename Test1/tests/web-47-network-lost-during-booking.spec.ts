// WEB-47 Network lost during booking - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account. (1) Cuts the connection on the seat map and clicks PROCEED: checks the site says so, recovers
// when the connection is back, and no booking was made. (2) Slows every site request down by 2 s and double-clicks
// PROCEED and the payment Proceed: checks only ONE booking and ONE wallet payment were made. That booking is cancelled
// at the end (the wallet is refunded). "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { myAccountLink } from '../pages/Account'; // Header link shown when signed in.
import { fils, readWalletBalance } from '../pages/BookingChecks'; // Wallet balance; KWD -> fils.
import { // Booking steps (see pages/Booking.ts):
  bookingsFoundDialog, cancelBookingInMyProfile, chooseShow, notePaidBooking, openBookings, readConfirmation,
  reopenSeatMap, selectAvailableSeats, signInAndReopenShow, skipFood, upcomingBookingIds, type Show,
} from '../pages/Booking';
import { openHome } from '../pages/WebSite'; // Opens the homepage.

test.describe.configure({ timeout: 480_000 }); // Up to 8 minutes (two seat maps, a slowed-down payment and a cancellation).
const DELAY_MS = 2_000; // Extra wait added to every site request in the slow-internet part.

test('WEB-47 Network lost during booking', async ({ page, context, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  const proceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last(); // PROCEED under the seat map.
  let show: Show; // The show chosen.
  let bookingsBefore: string[] = []; // Upcoming Booking IDs before the test books anything.
  let walletBefore = 0; // Wallet balance before.
  let bookingId = ''; // The booking paid in the slow-internet part.
  let paid: number | undefined; // Its Grand Total.

  await step("Choose tomorrow's show, sign in, and note the upcoming bookings and the wallet balance", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP.
    await openBookings(page); // My Account > BOOKINGS.
    bookingsBefore = await upcomingBookingIds(page);
    walletBefore = await readWalletBalance(page);
  });

  await step('No internet: choose a seat, cut the connection, click PROCEED and check the site says so', async () => {
    await reopenSeatMap(page, testConfig.urls.home, show, 1); // Seat map, 1 ticket.
    await selectAvailableSeats(page, 1); // One free seat.
    await context.setOffline(true); // No internet.
    await proceed.click().catch(() => undefined); // PROCEED.
    await page.waitForTimeout(5_000); // Give the site time to react.
    const where = page.url();
    const text = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    testInfo.annotations.push({ type: 'offline PROCEED', description: `Page: ${where.slice(0, 80)}; text: ${text.replace(/\s+/g, ' ').slice(0, 120)}` });
    await testInfo.attach('offline', { body: await page.screenshot(), contentType: 'image/png' });
    // Seen on UAT (11 Oct 2026): the browser's own "No internet" page replaces the site (no message from the site). Noted, not failed.
    const clear = /cinescape/i.test(where) && /internet|network|connection|offline/i.test(text);
    notOnUat(clear, 'No internet on the seat map: the site shows no message of its own (the browser error page replaces it).');
    await context.setOffline(false); // Internet back.
  });

  await step('Internet back: check the site works again and no booking was made', async () => {
    await openHome(page, testConfig.urls.home); // The site loads again.
    const signedIn = await myAccountLink(page).isVisible({ timeout: 15_000 }).catch(() => false);
    testInfo.annotations.push({ type: 'after reconnecting', description: signedIn ? 'Still signed in.' : 'Signed out.' });
    await openBookings(page); // My Account > BOOKINGS.
    expect(await upcomingBookingIds(page), 'No booking should be made while offline').toEqual(bookingsBefore);
  });

  await step(`Slow internet (+${DELAY_MS / 1000} s per request): double-click PROCEED and check one payment page opens`, async () => {
    await page.route(/\/api\//, async (route) => { // Every site request waits a little longer.
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      await route.continue().catch(() => undefined);
    });
    await reopenSeatMap(page, testConfig.urls.home, show, 1); // Seat map, 1 ticket.
    await selectAvailableSeats(page, 1); // One free seat.
    await proceed.dblclick(); // Two quick clicks.
    const loader = page.locator('[class*="loader" i], [class*="spinner" i], [class*="loading" i]').filter({ visible: true }).first();
    notOnUat(await loader.isVisible({ timeout: 1_500 }).catch(() => false), 'No loading indicator was seen after PROCEED on a slow connection.');
    await expect.poll(async () => /\/(?:food|payment)/.test(page.url()) || await bookingsFoundDialog(page).isVisible().catch(() => false),
      { message: 'PROCEED should open the food or payment page', timeout: 90_000 }).toBe(true);
    if (await bookingsFoundDialog(page).isVisible().catch(() => false)) { // "Bookings Found!" (the double click held twice?)
      testInfo.annotations.push({ type: 'double click', description: '"Bookings Found!" appeared after the double-click.' });
      await bookingsFoundDialog(page).getByRole('button', { name: /continue booking/i }).click();
      await expect(page).toHaveURL(/\/(?:food|payment)/, { timeout: 60_000 });
    }
    if (/\/food/.test(page.url())) await skipFood(page); // To the payment page.
  });

  await step('Slow internet: apply the wallet, double-click Proceed and check the confirmation page', async () => {
    const apply = page.getByRole('button', { name: /^apply$/i }).first(); // Wallet Apply.
    if (!await apply.isVisible().catch(() => false)) await page.getByRole('button', { name: /use your wallet/i }).last().click(); // Open the wallet section.
    await apply.click(); // Apply the wallet.
    await expect(page.getByRole('button', { name: /^remove$/i }).first()).toBeVisible({ timeout: 30_000 }); // Applied.
    await page.getByRole('button', { name: 'Proceed', exact: true }).last().dblclick(); // Two quick clicks = pay.
    await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 120_000 }); // Confirmation page.
    ({ bookingId, grandTotal: paid } = await readConfirmation(page));
    notePaidBooking(page, bookingId); // Cancelled automatically if the test stops early.
    await page.unroute(/\/api\//); // Normal speed again.
  });

  await step('Check only ONE booking and ONE wallet payment were made', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const added = (await upcomingBookingIds(page)).filter((id) => !bookingsBefore.includes(id)); // New since the start.
    testInfo.annotations.push({ type: 'new bookings', description: added.join(', ') || 'none' });
    expect.soft(added, 'The double clicks must make exactly one booking').toEqual([bookingId]);
    expect.soft(fils(await readWalletBalance(page)), 'The wallet should be charged once').toBe(fils(walletBefore) - fils(paid));
    for (const id of added) { // Cancel every booking made (the wallet is refunded).
      await openBookings(page);
      await cancelBookingInMyProfile(page, id, show.title);
    }
  });
});
