// WEB-34 Upcoming bookings list - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Pays one ticket for tomorrow with the test wallet, checks it in My Account > BOOKINGS (UPCOMING BOOKINGS), checks no
// past show is listed as upcoming, then cancels it (the wallet is refunded) and checks it leaves the list.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { expectTicketMatchesChoice, flatText, hoursUntilShow, type TicketChoice } from '../pages/BookingChecks'; // Ticket checks.
import { // Booking steps (see pages/Booking.ts):
  bookingCard, cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, payWithWallet,
  proceedToSeatMap, proceedWithFreeSeats, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood,
  upcomingBookingIds,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (booking, checks and cancellation).

test('WEB-34 Upcoming bookings list', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let choice: TicketChoice; // What was chosen.
  let bookingId = ''; // The new booking.

  await step("Book one seat for tomorrow's show and pay with the wallet", async () => {
    const show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    if (next === 'food') await skipFood(page); // To the payment page.
    const summary = await readPaymentSummary(page); // Seat shown for payment.
    choice = { ...show, location: 'Cinescape 360', category: 'General', seat: summary.seat }; // Everything chosen.
    ({ bookingId } = await payWithWallet(page)); // Pay; confirmation page with the Booking ID.
  });

  await step('Open My Account > BOOKINGS and check UPCOMING BOOKINGS lists it with the right details', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const card = bookingCard(page, bookingId, choice.title); // The new booking's card.
    await expect(card, 'The new booking should be listed under UPCOMING BOOKINGS').toBeVisible({ timeout: 30_000 });
    await expect.soft(card, 'The card should show the Booking ID').toContainText(bookingId);
    await expectTicketMatchesChoice(card, choice, 'Booking card'); // Movie, language, location, date & time, seat, category.
  });

  await step('Check every upcoming booking is for a show that has not started yet', async () => {
    const text = flatText(await page.locator('body').innerText()); // Bookings list text.
    const shows = [...text.matchAll(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s*\|\s*\d{1,2}:\d{2})\b/g)].map((match) => match[1]); // "01 Oct 2026 | 20:35".
    testInfo.annotations.push({ type: 'upcoming shows', description: [...new Set(shows)].join('; ') });
    for (const dateTime of new Set(shows)) {
      expect.soft(hoursUntilShow(dateTime), `"${dateTime}" is listed as upcoming, so it should not have started`).toBeGreaterThan(-0.25);
    }
  });

  await step('Cancel the booking and check it is no longer listed as upcoming', async () => {
    await cancelBookingInMyProfile(page, bookingId, choice.title); // Cancel Booking > Yes, I'm sure (refunded to the wallet).
    await openBookings(page); // Reopen the list.
    await expect.poll(() => upcomingBookingIds(page), { message: 'A cancelled booking should not be listed as upcoming', timeout: 30_000 })
      .not.toContain(bookingId);
  });
});
