// WEB-31 Payment fails or is cancelled at the gateway - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Signs in, notes the wallet balance and upcoming bookings, books one seat for tomorrow up to KNET, clicks Cancel on the
// KNET test gateway, and checks: no booking, no charge, and (with the second test account) the seat is free again.
// No card details are typed.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test accounts), step() and secondUser (second browser).
import { flatText, readWalletBalance } from '../pages/BookingChecks'; // Text and wallet helpers.
import { appears, openHome } from '../pages/WebSite'; // Opens the homepage; waits for a pop-up.
import { signIn } from '../pages/Account'; // Sign-in from the header.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, clickShowSignedOut, openBookings, proceedToSeatMap,
  proceedWithFreeSeats, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood, startKnetPayment,
  tryToReserveSeat, upcomingBookingIds, type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 420_000 }); // Up to 7 minutes (two sign-ins, the gateway and checks on the slow UAT site).
const fils = (kwd: number) => Math.round(kwd * 1000); // KWD → fils (whole numbers).

test('WEB-31 Payment fails or is cancelled at the gateway', async ({ page, step, testConfig, secondUser }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  let seatId = ''; // The seat held.
  let seatName = ''; // Its row and number, e.g. "D3".
  let walletBefore = 0; // Wallet balance before.
  let bookingsBefore: string[] = []; // Upcoming Booking IDs before.

  await step('Sign in and note the wallet balance and upcoming bookings', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await signIn(page, testConfig.credentials); // Email, password, OTP.
    await openBookings(page); // My Account > BOOKINGS.
    walletBefore = await readWalletBalance(page); // "Wallet Balance KWD ...".
    bookingsBefore = await upcomingBookingIds(page); // Booking IDs listed now.
  });

  await step("Choose tomorrow's show and one seat, and go on to the payment page", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // Signed in: goes straight to the seat category.
    await expect(page.getByText(/Select Seat Category/i).first()).toBeVisible({ timeout: 30_000 });
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next, seats, names } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    [seatId] = seats; // The seat now held,
    [seatName] = names; // e.g. "D3".
    if (next === 'food') await skipFood(page); // To the payment page.
    await readPaymentSummary(page); // Payment summary loaded.
  });

  await step('Choose KNET, then click Cancel on the KNET gateway', async () => {
    await startKnetPayment(page); // KNET + Proceed: the KNET test gateway opens.
    await page.getByRole('button', { name: /^cancel$/i }).filter({ visible: true }).first().click(); // Cancel the payment.
    const confirm = page.getByRole('button', { name: /^(?:yes|ok|confirm)$/i }).filter({ visible: true }).first(); // "Are you sure?" (if asked).
    if (await appears(confirm, 5_000)) await confirm.click();
    await page.waitForURL(/cinescape\.com\.kw/i, { timeout: 60_000 }); // Back on the Cinescape site.
  });

  await step('Check a clear failure message and no Booking ID', async () => {
    await page.waitForTimeout(3_000); // Let the result page draw.
    const text = flatText(await page.locator('body').innerText()); // What the user sees.
    testInfo.annotations.push({ type: 'after cancelling at KNET', description: `${page.url()} - ${text.slice(0, 200)}` });
    await expect(page, 'The booking must not be confirmed').not.toHaveURL(/result=success/i);
    expect.soft(text, 'A clear failure / cancelled message should be shown').toMatch(/fail|cancel|unsuccess|not (?:been )?(?:completed|successful)|declined/i);
    expect(text, 'No Booking ID should be shown').not.toMatch(/booking id\s*:?\s*[A-Z0-9]{5,}/i);
  });

  await step('Check My Account has no new booking and the same wallet balance', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const newBookings = (await upcomingBookingIds(page)).filter((id) => !bookingsBefore.includes(id)); // Any new IDs?
    expect(newBookings, 'No new booking should be listed').toEqual([]);
    expect(fils(await readWalletBalance(page)), 'The wallet balance should not change').toBe(fils(walletBefore));
  });

  await step('User 2 (second test account): check the seat can be reserved again', async () => {
    // Checked by another account: on UAT (1 Oct 2026) an account sees its own held seat as free, so only a second user's
    // reservation try shows whether the seat was really released.
    const second = testConfig.secondAccount; // The second test account.
    if (!second.username || !second.password || !second.pin) {
      testInfo.annotations.push({ type: 'seat after cancelled payment', description: 'Not checked: set TEST2_USERNAME, TEST2_PASSWORD and TEST2_PIN (second test account).' });
      return;
    }
    const page2 = secondUser.page; // User 2's page (separate browser).
    await clickShowSignedOut(page2, testConfig.urls.home, show); // Same show; the sign-in dialog opens.
    await signInAndReopenShow(page2, second, show); // Second account: email, password, OTP.
    const attempt = await tryToReserveSeat(page2, testConfig.urls.home, show, seatId); // Seat map, select, PROCEED.
    testInfo.annotations.push({ type: 'seat after cancelled payment', description: `User 2 sees ${seatName} as "${attempt.shown}"; reserving it: ${attempt.outcome}.` });
    await secondUser.shot('trying the seat after the cancelled payment');
    if (attempt.outcome === 'food' || attempt.outcome === 'payment') await cancelDuringBooking(page2); // Got it: give it back.
    expect.soft(attempt.outcome, 'After the payment is cancelled the seat should be free for other users again').toMatch(/^(?:food|payment)$/);
  });
});
