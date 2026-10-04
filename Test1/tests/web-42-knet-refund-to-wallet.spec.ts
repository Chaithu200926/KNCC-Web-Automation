// WEB-42 KNET booking refunded to the wallet after cancelling - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Pays one ticket for tomorrow with the KNET test card, cancels it, and checks the amount is credited to the wallet
// (a cancelled KNET booking is refunded to the customer's wallet). No trace is recorded (it would hold the card details).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, account, card) and step() (step + screenshot).
import { flatText, readWalletBalance } from '../pages/BookingChecks'; // Text and wallet helpers.
import { // Booking steps (see pages/Booking.ts):
  cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, payWithKnet, proceedToSeatMap,
  proceedWithFreeSeats, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';

test.use({ trace: 'off' }); // Traces record typed text, which here would include the KNET card number and PIN.
test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (KNET gateway and cancellation).
const fils = (kwd: number) => Math.round(kwd * 1000); // KWD → fils (whole numbers).

test('WEB-42 KNET booking refunded to the wallet after cancelling', async ({ page, step, testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  const { knetNumber, knetExpiry, knetPin } = testConfig.payment;
  test.skip(!username || !password || !pin || !knetNumber || !knetExpiry || !/^\d{4}$/.test(knetPin),
    'Set TEST_USERNAME, TEST_PASSWORD, TEST_PIN and the TEST_KNET_* card (4-digit PIN) to run this test.');
  let show: Show; // The show chosen.
  let booking = { bookingId: '', dateTime: '', grandTotal: undefined as number | undefined }; // The confirmed booking.
  let walletBefore = 0; // Wallet balance before cancelling.

  await step("Book tomorrow's show and pay with KNET", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    if (next === 'food') await skipFood(page); // To the payment page.
    await readPaymentSummary(page); // Wait for the order summary.
    booking = await payWithKnet(page, { knetNumber, knetExpiry, knetPin }); // KNET test gateway; confirmation page.
    expect(flatText(await page.locator('body').innerText()), 'Payment Mode should be Knet').toMatch(/Payment Mode\s*Knet/i);
  });

  await step('Note the wallet balance, then cancel the booking', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    walletBefore = await readWalletBalance(page); // Balance before cancelling.
    await cancelBookingInMyProfile(page, booking.bookingId, show.title); // Cancel Booking > Yes, I'm sure.
  });

  await step('Check the KNET amount is credited to the wallet', async () => {
    await openBookings(page); // Back to My Account.
    const expected = fils(walletBefore + (booking.grandTotal ?? 0)); // Balance + amount paid by KNET.
    await expect.poll(async () => { // Reload until the refund shows (up to 1 minute).
      const now = fils(await readWalletBalance(page));
      if (now !== expected) await page.reload({ waitUntil: 'domcontentloaded' });
      return now;
    }, { message: `Wallet should go from KWD ${walletBefore.toFixed(3)} up by ${booking.grandTotal?.toFixed(3)}`, timeout: 60_000 })
      .toBe(expected);
  });
});
