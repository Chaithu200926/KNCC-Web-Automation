// WEB-47 Refreshing the confirmation page does not book again - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Pays one ticket for tomorrow with the test wallet, then reloads the confirmation page and uses Back / Forward, and checks
// no second booking or payment was made. Every booking made is cancelled at the end (the wallet is refunded).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { readWalletBalance } from '../pages/BookingChecks'; // Wallet balance.
import { // Booking steps (see pages/Booking.ts):
  cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, payWithWallet, proceedFromSeatMap, proceedToSeatMap,
  readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood, upcomingBookingIds, type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 360_000 }); // Up to 6 minutes (booking, reloads, checks and cancellation).
const fils = (kwd: number) => Math.round(kwd * 1000); // KWD → fils (whole numbers).

test('WEB-47 Refreshing the confirmation page does not book again', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  let bookingId = ''; // The booking made.
  let confirmationUrl = ''; // Address of the confirmation page.
  let walletAfterBooking = 0; // Wallet balance right after the booking.
  let bookingsAfterBooking: string[] = []; // Upcoming Booking IDs right after the booking.
  let extraBookings: string[] = []; // Bookings made by the reload / Back / Forward (should be none).

  await step("Book one seat for tomorrow's show and pay with the wallet", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // To the payment page.
    await readPaymentSummary(page); // Payment summary loaded.
    ({ bookingId } = await payWithWallet(page)); // Pay; confirmation page.
    confirmationUrl = page.url(); // .../bookingconfirm?result=success...
  });

  await step('Note the wallet balance and the upcoming bookings', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    walletAfterBooking = await readWalletBalance(page); // Balance after paying.
    bookingsAfterBooking = await upcomingBookingIds(page); // IDs listed now (includes the new one).
    expect(bookingsAfterBooking, 'The new booking should be listed').toContain(bookingId);
  });

  await step('Open the confirmation page again, reload it, and use Back and Forward', async () => {
    await page.goto(confirmationUrl, { waitUntil: 'domcontentloaded' }); // The confirmation page again.
    await page.reload({ waitUntil: 'domcontentloaded' }); // Refresh.
    await page.waitForTimeout(3_000); // Let it finish whatever it does on load.
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined); // Back.
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => undefined); // Forward.
    await page.waitForTimeout(3_000);
    testInfo.annotations.push({ type: 'confirmation page after reload', description: page.url() });
  });

  await step('Check no second booking or payment was made', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    extraBookings = (await upcomingBookingIds(page)).filter((id) => !bookingsAfterBooking.includes(id)); // New IDs since.
    expect.soft(extraBookings, 'Reloading must not create another booking').toEqual([]);
    expect.soft(fils(await readWalletBalance(page)), 'Reloading must not charge the wallet again').toBe(fils(walletAfterBooking));
  });

  await step('Cancel the booking (and any extra one), so the wallet is refunded', async () => {
    for (const id of [bookingId, ...extraBookings]) {
      await openBookings(page); // The list (cancelling returns to the homepage).
      await cancelBookingInMyProfile(page, id, show.title); // Cancel Booking > Yes, I'm sure.
    }
  });
});
