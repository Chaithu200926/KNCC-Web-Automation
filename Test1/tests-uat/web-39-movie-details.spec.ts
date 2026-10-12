// WEB-39 Movie details on the homepage and through booking - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the test account; goes up to the payment summary and then cancels (nothing is paid). Then opens the movie page
// link in a new signed-out browser, as a shared link would be opened.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { expectMovieDetails, expectTicketMatchesChoice, readHomeMovieCard, readMovieDetails } from './pages/BookingChecks'; // Detail checks.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, proceedToSeatMap, proceedWithFreeSeats, readPaymentSummary,
  selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from './pages/Booking';
import { openHome } from './pages/WebSite'; // Opens the homepage.

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in and seat map on the slow UAT site).

test('WEB-39 Movie details on the homepage and through booking', async ({ browser, page, step, testConfig }, testInfo) => {
  let movieUrl = ''; // Address of the first movie's page (as a shared link would be).
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.

  await step('Check the first homepage movie card and its movie page show all the details', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    const bookNow = page.locator('.banner-item a[href*="/moviesessions/"]').first(); // First movie's Book Now.
    const card = await readHomeMovieCard(bookNow); // Title, rating, language, genre, run time on the card.
    movieUrl = new URL((await bookNow.getAttribute('href')) ?? '', testConfig.urls.home).toString(); // Its movie page address.
    await page.goto(movieUrl, { waitUntil: 'commit' }); // Its movie page.
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
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    if (next === 'food') await skipFood(page); // Tomorrow: straight to payment (skip food if shown).
    const summary = await readPaymentSummary(page); // Seat and total on the payment page.
    await expectTicketMatchesChoice(page.locator('body'), { ...show, location: 'Cinescape 360', category: 'General', seat: summary.seat }, 'Payment summary', 'summary');
  });

  await step('Cancel the booking (nothing is paid)', async () => {
    await cancelDuringBooking(page); // Cancel on the payment page; the seat is released.
  });

  await step('Open the movie page link in a new, signed-out browser (as a shared link) and check it shows the movie', async () => {
    const context = await browser.newContext(); // New incognito window: not signed in.
    const shared = await context.newPage();
    try {
      await shared.goto(movieUrl, { waitUntil: 'commit' }); // The link, opened directly.
      const details = await readMovieDetails(shared); // Language, genre, run time, ...
      expect(details.title, 'The shared link should show the movie title').not.toBe('');
      expect(details.language ?? '', 'The shared link should show the movie language').not.toBe('');
      await expect(shared.locator('.time-box').first(), 'The shared link should show showtimes').toBeVisible({ timeout: 30_000 });
      testInfo.annotations.push({ type: 'shared movie link', description: movieUrl });
    } finally {
      await context.close();
    }
  });
});
