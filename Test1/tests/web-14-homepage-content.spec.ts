// WEB-14 Homepage content - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-14 Homepage content', async ({ page, step, testConfig }, testInfo) => {
  const home = new HomePage(page); // Helper object for the homepage sections.
  await step('Open the homepage', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage and wait for the movie list.
  });

  let banner: Awaited<ReturnType<typeof bannerMovies>> = []; // Banner movies, reused in the last step.
  await step('Check each banner movie shows title, rating, language, genre, run time, WATCH TRAILER and Book Now', async () => {
    banner = await bannerMovies(page); // Read the banner movies.
    expect(banner.length, 'The homepage banner should list movies').toBeGreaterThan(0); // At least one movie.
    for (const movie of banner) { // For each movie:
      for (const field of ['title', 'rating', 'language', 'genre', 'runTime'] as const) {
        expect.soft(movie[field], `Banner movie "${movie.title}" should show its ${field}`).not.toBe(''); // the detail is shown,
        expect.soft(movie[field], `Banner movie "${movie.title}": ${field} should not be "null"`).not.toMatch(/\bnull\b/i); // and is not "null".
      }
      expect.soft(movie.trailer, `Banner movie "${movie.title}" should offer WATCH TRAILER`).toBe(true); // Trailer offered.
      expect.soft(movie.bookNow, `Banner movie "${movie.title}": Book Now should open its movie page`).toMatch(/^\/moviesessions\//); // Book Now link.
    }
    await testInfo.attach('banner movies', { body: JSON.stringify(banner, null, 2), contentType: 'application/json' }); // Keep the list in the report.
  });

  await step('Check EXPERIENCES, CINESCAPE LOCATIONS and EVENTS & PROMOTIONS', async () => {
    await home.expectExperiencesDisplayed(); // EXPERIENCES: heading, 4 experience images and VIEW ALL.
    await home.expectLocationsDisplayed(); // CINESCAPE LOCATIONS: heading and a cinema link.
    await home.expectPromotionsDisplayed(); // EVENTS & PROMOTIONS: heading, VIEW ALL and an image.
  });

  await step('Check no image on the homepage is broken', async () => {
    await scrollThrough(page); // Scroll down and back up so lazy-loaded images load.
    const failed = await brokenImages(page); // Images the browser could not show (e.g. a missing poster).
    const broken: string[] = []; // Only those the server really refuses (not just slow), with the HTTP status.
    for (const image of failed) {
      const url = image.slice(image.indexOf('http')); // "title: address" -> address.
      const status = await page.request.get(url, { timeout: 30_000 }).then((response) => response.status(), () => 0); // Ask again.
      if (status === 0 || status >= 400) broken.push(`${image} (HTTP ${status || 'no answer'})`);
    }
    expect.soft(broken, 'Broken images on the homepage (e.g. a missing poster)').toEqual([]); // There should be none.
  });

  await step('Check the banner movies are on the Movies page (Now Showing or Advance Booking)', async () => {
    await openMovies(page, testConfig.urls.home); // Open the Movies page.
    const listed = [...await openMoviesTab(page, 'Now Showing'), ...await openMoviesTab(page, 'Advance Booking')] // Movies on both tabs,
      .map((card) => card.title); // by title.
    for (const movie of banner) { // Every banner movie must be listed there.
      expect.soft(listed.some((title) => sameTitle(title, movie.title)), `"${movie.title}" should be listed on the Movies page`).toBe(true);
    }
  });
});
