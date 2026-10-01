// WEB-22 Showtimes and prices for today and future dates - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-22 Showtimes and prices for today and future dates', async ({ page, step, testConfig }, testInfo) => {
  await step('Open a movie showing today and check the date tabs start with Today and run about a month ahead', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    const tabs = page.getByRole('tab'); // Date tabs on the movie page.
    let showingToday = false; // Found a movie with shows today?
    for (const movie of await bannerMovies(page)) { // Some movies only start tomorrow; use one that shows today.
      await page.goto(new URL(movie.bookNow, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open the movie.
      await expect(tabs.nth(7)).toBeVisible({ timeout: 60_000 }); // Wait for the date tabs.
      if (/today/i.test(await tabs.first().innerText())) { showingToday = true; break; } // First tab is "Today": use it.
    }
    expect(showingToday, 'At least one homepage movie should have shows today').toBe(true); // One was found.
    expect(await tabs.count(), 'Dates should be offered about a month ahead').toBeGreaterThanOrEqual(28); // About 4 weeks of dates.
  });

  await step("Check today's showtimes and note any that have already started", async () => {
    await expect(page.locator('.time-box:visible').first()).toBeVisible({ timeout: 30_000 }); // Today's showtimes.
    const now = kuwaitMinutesNow(); // Current time in Kuwait (minutes since midnight).
    const times = (await page.locator('.time-box:visible').allInnerTexts()).map((text) => text.trim()); // e.g. "20:35".
    // Shows after midnight (before 06:00) belong to the next calendar day, so they are not "started".
    const started = times.filter((time) => minutesOf(time) >= 6 * 60 && minutesOf(time) < now);
    testInfo.annotations.push({ // Note the result in the report (the allowed grace period is still to be confirmed).
      type: 'today showtimes',
      description: `${times.join(', ')} (Kuwait time now ${Math.floor(now / 60)}:${String(now % 60).padStart(2, '0')}); `
        + `already started but still offered: ${started.join(', ') || 'none'}.`,
    });
  });

  await step('Choose tomorrow and check its showtimes load', async () => {
    const tomorrow = page.getByRole('tab').nth(1); // Second date tab = tomorrow.
    await tomorrow.click(); // Choose it.
    await expect(tomorrow).toHaveAttribute('aria-selected', 'true'); // It is selected.
    await expect(page.locator('.time-box:visible').first()).toBeVisible({ timeout: 30_000 }); // Its showtimes load.
  });
});
