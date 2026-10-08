// WEB-21 Showtimes by location - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-21 Showtimes by location', async ({ page, step, testConfig }) => {
  let todayShows = 0; // Number of showtimes today at the cinema.
  await step('Open CINESCAPE LOCATIONS > Cinescape 360 from the homepage', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    // Found by its name: since the 8 Oct 2026 deployment Cinescape Ajial and Avenues are listed too, in a changing order.
    await page.locator('section.location-section .location-preview').filter({ hasText: /cinescape 360/i }).first()
      .locator('a[href*="/cinemasessions/"]').first() // The Cinescape 360 link
      .evaluate((link) => (link as HTMLAnchorElement).click()); // clicked directly.
    await page.waitForURL(/\/cinemasessions\//, { timeout: 60_000 }); // The cinema page opens.
    await expect(page.getByText(/^cinescape 360$/i).first()).toBeVisible({ timeout: 60_000 }); // Its name is shown.
  });

  await step("Check the cinema page lists today's movies with showtimes", async () => {
    await expect(page.locator('.time-box:visible').first()).toBeVisible({ timeout: 60_000 }); // Showtimes are listed.
    todayShows = await page.locator('.time-box:visible').count(); // Count them.
    const movieSlots = page.locator('.time-slot-cinemasessions').filter({ visible: true }); // One block per movie.
    expect(await movieSlots.count(), 'Showtimes should be grouped by movie').toBeGreaterThan(0); // Grouped by movie.
  });

  await step('Choose another date and check the showtimes update', async () => {
    const tomorrow = page.getByRole('tab').nth(1); // Second date tab = tomorrow.
    await tomorrow.click(); // Choose it.
    await expect(tomorrow).toHaveAttribute('aria-selected', 'true'); // It is selected.
    await expect(page.locator('.time-box:visible').first()).toBeVisible({ timeout: 30_000 }); // Its showtimes load.
    expect(await page.locator('.time-box:visible').count(), `Tomorrow's showtimes (today: ${todayShows})`).toBeGreaterThan(0); // At least one.
  });

  await step('Check a movie page groups its sessions under Cinescape 360', async () => {
    await openHome(page, testConfig.urls.home); // Back to the homepage.
    const href = (await bannerMovies(page))[0].bookNow; // First banner movie.
    await page.goto(new URL(href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open its page.
    await expect(page.locator('.cinemacarousal').filter({ hasText: /cinescape 360/i }).first()).toBeVisible({ timeout: 60_000 }); // Cinema bar.
    await expect(page.locator('.time-box:visible').first()).toBeVisible({ timeout: 30_000 }); // Its showtimes.
  });
});
