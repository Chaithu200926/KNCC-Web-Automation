// WEB-36 Cancel 2 hours or more before the show; wallet credited back - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Pays one ticket for tomorrow with the test wallet, cancels it, and checks the wallet gets the amount back.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { hoursUntilShow, readWalletBalance } from '../pages/BookingChecks'; // 2-hour window and wallet balance.
import { // Booking steps (see pages/Booking.ts):
  bookingCard, cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, payWithWallet,
  proceedToSeatMap, proceedWithFreeSeats, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood,
  type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (booking and cancellation).
const fils = (kwd: number) => Math.round(kwd * 1000); // KWD → fils (whole numbers, no rounding surprises).

test('WEB-36 Cancel 2 hours or more before the show; wallet credited back', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  let booking = { bookingId: '', dateTime: '', grandTotal: undefined as number | undefined }; // The confirmed booking.
  let walletAfterBooking = 0; // Wallet balance after paying.

  await step("Book tomorrow's show and pay with the wallet", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    if (next === 'food') await skipFood(page); // To the payment page.
    await readPaymentSummary(page); // Wait for the order summary.
    booking = await payWithWallet(page); // Pay; confirmation page.
    expect(booking.grandTotal, 'The confirmation page should show the Grand Total').toBeDefined();
  });

  await step('Open My Account > Bookings; note the wallet balance and check the show is 2 hours or more away', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    walletAfterBooking = await readWalletBalance(page); // "Wallet Balance KWD ...".
    const hoursLeft = hoursUntilShow(booking.dateTime); // Hours until the show (Kuwait time).
    testInfo.annotations.push({ type: 'cancellation window', description: `Show starts in ${hoursLeft.toFixed(1)} h.` });
    expect(hoursLeft, 'The show should be at least 2 hours away').toBeGreaterThanOrEqual(2);
    await expect(bookingCard(page, booking.bookingId, show.title).locator('button, a').filter({ hasText: /cancel booking/i }).filter({ visible: true }).first(),
      'Cancel Booking should be offered').toBeVisible(); // Cancelling is offered.
  });

  await step('Cancel the booking and check it leaves UPCOMING BOOKINGS', async () => {
    await cancelBookingInMyProfile(page, booking.bookingId, show.title); // Cancel Booking > Yes, I'm sure.
    await openBookings(page); // Reopen the list.
    await expect(page.locator('body')).not.toContainText(booking.bookingId, { timeout: 30_000 }); // No longer upcoming.
  });

  await step('Check the wallet balance is credited back by the amount paid', async () => {
    const expected = fils(walletAfterBooking + (booking.grandTotal ?? 0)); // Balance after paying + amount paid.
    await expect.poll(async () => { // The refund can take a moment: reload until it shows (up to 1 minute).
      const now = fils(await readWalletBalance(page));
      if (now !== expected) await page.reload({ waitUntil: 'domcontentloaded' });
      return now;
    }, { message: `Wallet should go from KWD ${walletAfterBooking.toFixed(3)} up by ${booking.grandTotal?.toFixed(3)}`, timeout: 60_000 })
      .toBe(expected);
  });
});
