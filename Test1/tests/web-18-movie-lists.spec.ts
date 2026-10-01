// WEB-18 Movie lists (Movies page tabs) - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-18 Movie lists (Movies page tabs)', async ({ page, step, testConfig }, testInfo) => {
  const lists: Record<string, Awaited<ReturnType<typeof movieCards>>> = {}; // Movies listed on each tab.
  await step('Open Movies and check the five tabs', async () => {
    await openMovies(page, testConfig.urls.home); // Open the Movies page.
    for (const tab of MOVIES_TABS) await expect(moviesTabs(page).getByText(tab, { exact: true })).toBeVisible(); // Each tab is shown.
  });

  for (const tab of MOVIES_TABS) { // One step per tab:
    await step(`Check the ${tab} tab lists movies with poster, title and age rating`, async () => {
      lists[tab] = await openMoviesTab(page, tab); // Click the tab and read its movie cards.
      if (tab === 'Now Showing' || tab === 'Coming Soon') { // These two must never be empty
        expect(lists[tab].length, `${tab} should list movies`).toBeGreaterThan(0); // (the others can be, e.g. Last Chance).
      }
      for (const card of lists[tab]) { // Every card:
        expect.soft(card.title, `${tab}: every movie should have a title`).not.toBe(''); // has a title (poster name),
        expect.soft(card.rating, `${tab}: "${card.title}" should show its age rating`).not.toBe(''); // and an age rating.
      }
    });
  }
  await testInfo.attach('movie lists', { body: JSON.stringify(lists, null, 2), contentType: 'application/json' }); // Keep the lists.

  await step('Check Coming Soon movies open a details page without showtimes (cannot be booked yet)', async () => {
    for (const card of lists['Coming Soon'] ?? []) { // Coming Soon movies link to a details page, not to booking.
      expect.soft(card.href, `Coming Soon "${card.title}" should not link to a booking page`).toMatch(/^\/movie-details\//);
    }
    const first = lists['Coming Soon'][0]; // First Coming Soon movie.
    await page.goto(new URL(first.href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open its page.
    await expect(page.locator('body')).toContainText(new RegExp(first.title.split(/\s+/)[0], 'i'), { timeout: 60_000 }); // Its title is shown.
    await expect(page.locator('.time-box')).toHaveCount(0); // No showtimes to book.
  });

  await step('Open a Now Showing movie and check its page and title', async () => {
    const first = lists['Now Showing'][0]; // First Now Showing movie.
    await page.goto(new URL(first.href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open its page.
    await expect(page.locator('h3.title-info').filter({ visible: true }).first()).toHaveText(titleRegExp(first.title), { timeout: 60_000 }); // Same title.
  });
});
