// WEB-19 Movie filters - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-19 Movie filters', async ({ page, step, testConfig }, testInfo) => {
  const filterButton = page.locator('.filter-button .accordion__button').filter({ visible: true }).first(); // "Filters" button.
  const options = page.locator('label.radio-custom-label').filter({ visible: true }); // Options of the open filter group.
  let allMovies = 0; // Number of Now Showing movies without filters.
  let genre = ''; // Genre used for filtering.
  let genreMovies: Awaited<ReturnType<typeof movieCards>> = []; // Movies left after the genre filter.

  await step('Open Filters on the Movies page and check the filter groups', async () => {
    await openMovies(page, testConfig.urls.home); // Open the Movies page.
    allMovies = (await openMoviesTab(page, 'Now Showing')).length; // Count all Now Showing movies.
    await filterButton.click(); // Open the Filters panel.
    for (const group of ['Location', 'Experience', 'Genre', 'Time', 'Language', 'Rating']) { // Each filter group
      await expect(page.getByRole('tab', { name: group })).toBeVisible(); // is offered.
    }
  });

  await step('Check the Genre options are not repeated', async () => {
    await page.getByRole('tab', { name: 'Genre' }).click(); // Open the Genre group.
    const genres = (await options.allInnerTexts()).map((text) => text.trim()); // All genre options.
    await testInfo.attach('genre options', { body: genres.join('\n'), contentType: 'text/plain' }); // Keep them in the report.
    const repeated = genres.filter((name, index) => genres.indexOf(name) !== index); // Options listed a second time.
    expect.soft([...new Set(repeated)], 'Genre options listed more than once').toEqual([]); // There should be none.
    genre = genres.includes('Horror') ? 'Horror' : genres[0]; // Filter by Horror (or the first genre if there is none).
  });

  await step('Apply one genre and check only matching movies are listed', async () => {
    await options.filter({ hasText: new RegExp(`^${genre}$`) }).first().click(); // Tick the genre.
    await page.getByRole('button', { name: 'Apply Filters' }).click(); // Apply.
    await expect.poll(async () => (await movieCards(page)).length, { timeout: 15_000 }).toBeLessThan(allMovies); // Fewer movies listed.
    genreMovies = await movieCards(page); // The movies left.
    expect(genreMovies.length, `Some movies should match the genre "${genre}"`).toBeGreaterThan(0); // But not none.
  });

  await step('Open the first filtered movie and check its genre', async () => {
    await page.goto(new URL(genreMovies[0].href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open the first one.
    const genreBox = page.locator('.movie-info-box').filter({ hasText: /genre/i }).first(); // Its GENRE detail.
    await expect(genreBox).toContainText(new RegExp(genre, 'i'), { timeout: 60_000 }); // Includes the chosen genre.
    await page.goBack(); // Back to the Movies page.
    await expect(moviesTabs(page)).toBeVisible({ timeout: 60_000 }); // Wait for it.
  });

  await step('Add an age-rating filter and check the list narrows to that rating', async () => {
    await openMovies(page, testConfig.urls.home); // Start again from the Movies page.
    await filterButton.click(); // Open Filters.
    await page.getByRole('tab', { name: 'Genre' }).click(); // Genre group:
    await options.filter({ hasText: new RegExp(`^${genre}$`) }).first().click(); // tick the same genre.
    const rating = genreMovies[0].rating; // Age rating of the first matching movie (so the result is not empty).
    await page.getByRole('tab', { name: 'Rating' }).click(); // Rating group:
    await options.filter({ hasText: new RegExp(`^${rating.replace(/[+]/g, '\\+')}$`) }).first().click(); // tick that rating.
    await page.getByRole('button', { name: 'Apply Filters' }).click(); // Apply both filters.
    await expect.poll(async () => (await movieCards(page)).length, { timeout: 15_000 }).toBeLessThanOrEqual(genreMovies.length); // Same or fewer.
    for (const card of await movieCards(page)) expect.soft(card.rating, `"${card.title}" should have the rating ${rating}`).toBe(rating); // All match.
  });

  await step('Reset the filters and check the full list returns', async () => {
    if (!await page.getByText('Reset', { exact: true }).isVisible()) await filterButton.click(); // Open Filters if it closed.
    await page.getByText('Reset', { exact: true }).click(); // Click Reset.
    await page.getByRole('button', { name: 'Apply Filters' }).click().catch(() => undefined); // Apply (if Reset does not apply by itself).
    await expect.poll(async () => (await movieCards(page)).length, { timeout: 15_000 }).toBe(allMovies); // All movies are back.
  });
});
