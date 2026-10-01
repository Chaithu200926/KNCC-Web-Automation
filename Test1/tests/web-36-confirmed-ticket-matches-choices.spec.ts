// WEB-36 Confirmed ticket matches the choices - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Pays one ticket for tomorrow with the test wallet, checks the ticket, then cancels it (the wallet is refunded).
// Checks after the payment are "soft" (expect.soft): a mismatch is reported, but the booking is always cancelled.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { expectTicketMatchesChoice, flatText, type TicketChoice } from '../pages/BookingChecks'; // Ticket detail checks.
import { // Booking steps (see pages/Booking.ts):
  bookingCard, cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, payWithWallet, proceedFromSeatMap,
  proceedToSeatMap, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (booking, checks and cancellation).

test('WEB-36 Confirmed ticket matches the choices', async ({ page, step, testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let choice: TicketChoice; // What was chosen.
  let booking = { bookingId: '', dateTime: '', grandTotal: undefined as number | undefined }; // The confirmed booking.
  let amountToPay: number | undefined; // "Total amount to be paid" on the payment page.

  await step("Book tomorrow's show: General / Standard, one free seat", async () => {
    const show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page, 'General', 'Standard'); // Seat category and type.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // To the payment page.
    const summary = await readPaymentSummary(page); // Seat and total shown for payment.
    amountToPay = summary.total;
    choice = { ...show, location: 'Cinescape 360', category: 'General', seat: summary.seat }; // Everything chosen.
    await expectTicketMatchesChoice(page.locator('body'), choice, 'Payment summary', 'summary'); // Summary matches.
  });

  await step('Pay with the wallet and check the confirmation page shows the choices', async () => {
    booking = await payWithWallet(page); // Pay; confirmation page.
    await expectTicketMatchesChoice(page.locator('body'), choice, 'Confirmation page'); // Movie, language, location, date & time, seat, category.
    expect.soft(booking.bookingId, 'The confirmation page should show a Booking ID').toMatch(/^\w{5,}$/);
    expect.soft(booking.grandTotal, 'Grand Total should equal the amount to pay').toBe(amountToPay);
    expect.soft(flatText(await page.locator('body').innerText()), 'Payment Mode should be Wallet').toMatch(/Payment Mode\s*Wallet/i);
    await expect.soft(page.locator('img[src*="data:image"], canvas, svg').first(), 'A ticket QR code should be shown').toBeVisible();
  });

  await step('Check the booking card in My Account > Bookings shows the same details', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const card = bookingCard(page, booking.bookingId, choice.title); // This booking's card.
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expectTicketMatchesChoice(card, choice, 'Booking card'); // Same details.
  });

  await step('Cancel the booking (the wallet is refunded)', async () => {
    await cancelBookingInMyProfile(page, booking.bookingId, choice.title); // Cancel Booking > Yes, I'm sure.
  });
});
