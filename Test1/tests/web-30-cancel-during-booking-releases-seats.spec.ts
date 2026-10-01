// WEB-30 Cancel during booking releases the seats - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Holds one seat for tomorrow's show up to the payment page, clicks Cancel, and checks the seat is free again.
// Nothing is paid.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, proceedFromSeatMap, proceedToSeatMap, readPaymentSummary,
  reopenSeatMap, seatState, selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (sign-in, seat map twice on the slow UAT site).

test('WEB-30 Cancel during booking releases the seats', async ({ page, step, testConfig }) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  let seatId = ''; // The seat held.

  await step("Choose tomorrow's show and one seat, and go on to the payment page", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    [seatId] = await selectAvailableSeats(page, 1); // One free seat (its id, e.g. "0000000007|2|9|17").
    if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // To the payment page (the seat is now held).
    await readPaymentSummary(page); // Payment summary loaded.
  });

  await step('Click Cancel and check the site leaves the booking pages', async () => {
    await cancelDuringBooking(page); // Cancel (confirm if asked); no longer on the food / payment / seat pages.
    await expect.soft(page, 'Cancel should return to the movie page or the homepage').toHaveURL(/\/moviesessions\/|\.com\.kw\/?(?:\?.*)?$/);
  });

  await step('Open the same show again and check the seat is Available again', async () => {
    await reopenSeatMap(page, testConfig.urls.home, show); // Same movie, date and time; General / Standard; seat map.
    await expect.poll(() => seatState(page, seatId), { message: 'The cancelled seat should be Available again', timeout: 30_000 })
      .toBe('available'); // Released at once.
  });
});
