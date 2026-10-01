// WEB-45 Movie details on the homepage and through booking - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account; goes up to the payment summary and then cancels (nothing is paid).
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { expectMovieDetails, expectTicketMatchesChoice, readHomeMovieCard, readMovieDetails } from '../pages/BookingChecks'; // Detail checks.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, proceedFromSeatMap, proceedToSeatMap, readPaymentSummary,
  selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';
import { openHome } from '../pages/WebSite'; // Opens the homepage.

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in and seat map on the slow UAT site).

test('WEB-45 Movie details on the homepage and through booking', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.

  await step('Check the first homepage movie card and its movie page show all the details', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    const bookNow = page.locator('.banner-item a[href*="/moviesessions/"]').first(); // First movie's Book Now.
    const card = await readHomeMovieCard(bookNow); // Title, rating, language, genre, run time on the card.
    await page.goto(new URL((await bookNow.getAttribute('href')) ?? '', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Its movie page.
    const details = await readMovieDetails(page); // Language, genre, subtitle, run time, director, cast, synopsis.
    expectMovieDetails(card, details); // All shown, and the same as on the card.
    await testInfo.attach('movie details', { body: JSON.stringify({ card, details }, null, 2), contentType: 'application/json' }); // Keep them.
  });

  await step("Choose tomorrow's show, sign in and check the details stay shown on Select Seat Category", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // First homepage movie with a show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await expect.soft(page.locator('h3.title-info').filter({ visible: true }).first(), 'Movie title should stay shown').toBeVisible();
    await expect.soft(page.locator('.movie-info').first(), 'Movie details should stay shown').toBeVisible();
  });

  await step('Choose a seat and check the payment summary shows the same movie and language', async () => {
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // Tomorrow: straight to payment (skip food if shown).
    const summary = await readPaymentSummary(page); // Seat and total on the payment page.
    await expectTicketMatchesChoice(page.locator('body'), { ...show, location: 'Cinescape 360', category: 'General', seat: summary.seat }, 'Payment summary', 'summary');
  });

  await step('Cancel the booking (nothing is paid)', async () => {
    await cancelDuringBooking(page); // Cancel on the payment page; the seat is released.
  });
});
