// WEB-23 Half-price Monday - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Compares the General / Standard ticket price of one movie on the next Tuesday (normal price) and the next Monday
// (half price), then goes up to the payment summary for the Monday show and cancels (nothing is paid).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { readKwdAfter } from '../pages/BookingChecks'; // Reads "KWD x.xxx" after a label.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, chooseShowOfMovie, proceedToSeatMap, proceedWithFreeSeats,
  readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (two shows, seat map and payment page on the slow UAT site).
const fils = (kwd: number | undefined) => Math.round((kwd ?? NaN) * 1000); // KWD → fils (whole numbers, no rounding surprises).

test('WEB-23 Half-price Monday', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let tuesday: Show; // The normal-price show.
  let monday: Show | undefined; // The half-price show.
  let normalPrice = 0; // General / Standard price on Tuesday.
  let mondayPrice = 0; // The same on Monday.

  await step("Sign in on a Tuesday show and note the General / Standard price", async () => {
    tuesday = await chooseShow(page, testConfig.urls.home, 'tuesday'); // First homepage movie with a show next Tuesday.
    await signInAndReopenShow(page, testConfig.credentials, tuesday); // Email, password, OTP; same show again.
    normalPrice = await chooseCategoryAndType(page); // Price shown on the Standard seat type, e.g. 3.500.
    expect(normalPrice, 'The Standard seat type should show a price').toBeGreaterThan(0);
  });

  await step('Open the same movie on Monday and check the General / Standard price is half', async () => {
    monday = await chooseShowOfMovie(page, testConfig.urls.home, tuesday.href, 'monday'); // Same movie, next Monday.
    test.skip(!monday, `${tuesday.movieTitle} has no daytime show next Monday.`); // Nothing to compare.
    await expect(page.getByText(/Select Seat Category/i).first()).toBeVisible({ timeout: 30_000 }); // Signed in: straight to seat category.
    mondayPrice = await chooseCategoryAndType(page); // Monday price, e.g. 1.750.
    testInfo.annotations.push({ type: 'prices', description: `Tuesday KWD ${normalPrice.toFixed(3)}, Monday KWD ${mondayPrice.toFixed(3)}.` });
    expect(fils(mondayPrice), `Monday should cost half of KWD ${normalPrice.toFixed(3)}`).toBe(Math.round(fils(normalPrice) / 2));
  });

  await step('Choose a seat and check the payment summary charges the Monday price', async () => {
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, monday!); // PROCEED (other seats if this one is held).
    if (next === 'food') await skipFood(page); // A future date goes straight to payment.
    const summary = await readPaymentSummary(page); // Payment page summary.
    expect.soft(fils(readKwdAfter(summary.text, 'Ticket Price')), 'Ticket Price should be the Monday price').toBe(fils(mondayPrice));
    expect.soft(fils(summary.total), 'Total amount to be paid should be the Monday price').toBe(fils(mondayPrice));
  });

  await step('Cancel the booking (nothing is paid)', async () => {
    await cancelDuringBooking(page); // Cancel; the seat is released.
  });
});
