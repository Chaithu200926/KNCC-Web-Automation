// WEB-16 Search movies - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-16 Search movies', async ({ page, step, testConfig }) => {
  const home = new HomePage(page); // Helper object for the header search box.
  let title = ''; // A movie title taken from the homepage.
  let fragment = ''; // Part of that title, typed into the search box.
  const suggestions = page.locator('nav.header-nav p > a[href*="/moviesessions/"]').filter({ visible: true }); // Suggested movies.

  await step('Open the search box', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    const movies = await bannerMovies(page); // Movies currently showing.
    title = (movies[1] ?? movies[0]).title; // Use the second banner movie (or the first if there is only one).
    fragment = (title.split(/\s+/).find((word) => word.length >= 4) ?? title) // Its first word of 4+ letters,
      .toLowerCase().replace(/[^a-z0-9]/g, ''); // lower case, letters and digits only (e.g. "hounds").
    await home.searchControl.click(); // Click SEARCH in the header.
    await expect(home.searchInput).toBeVisible(); // The search box opens.
  });

  await step('Type part of a title and check matching titles are suggested', async () => {
    await home.searchInput.fill(fragment); // Type the part of the title.
    // The list first shows every movie, then narrows to the ones matching the typed text.
    await expect.poll(async () => {
      const texts = (await suggestions.allInnerTexts()).map((text) => text.toLowerCase()); // Suggested titles.
      return texts.length > 0 && texts.every((text) => text.includes(fragment)); // All of them contain the typed text?
    }, { message: `Every suggestion should contain "${fragment}"`, timeout: 15_000 }).toBe(true);
    await expect(suggestions.filter({ hasText: titleRegExp(title) }).first()).toBeVisible(); // The movie itself is suggested.
  });

  await step('Choose the suggestion and check its movie page opens', async () => {
    await suggestions.filter({ hasText: titleRegExp(title) }).first().click(); // Click the suggested movie.
    await expect(page).toHaveURL(/\/moviesessions\//); // Its movie page opens.
    await expect(page.locator('h3.title-info').filter({ visible: true }).first()).toHaveText(titleRegExp(title), { timeout: 30_000 }); // Right movie.
  });

  await step('Search the full title in upper case and check it is found', async () => {
    await home.searchControl.click(); // Open the search box again.
    await home.searchInput.fill(title.toUpperCase()); // Type the whole title in capitals.
    await expect(suggestions.filter({ hasText: titleRegExp(title) }).first()).toBeVisible({ timeout: 15_000 }); // Still found.
  });

  await step('Search text that matches nothing and check no suggestion and no error', async () => {
    await home.searchInput.fill('zzqqxx'); // Text no movie contains.
    await expect(suggestions).toHaveCount(0, { timeout: 15_000 }); // No suggestions.
    await expect(home.searchInput).toBeVisible(); // The page still works (no error).
    await home.closeSearch(); // Close the search box.
  });
});
