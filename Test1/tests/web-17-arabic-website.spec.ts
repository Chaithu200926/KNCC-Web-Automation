// WEB-17 Arabic website - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-17 Arabic website', async ({ page, step, testConfig }) => {
  const home = new HomePage(page); // Helper object for the header (profile dialog).
  await step('Switch the homepage to Arabic and check it is Arabic and right-to-left', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await switchLanguage(page, 'ar'); // Click the Arabic button; the page turns right-to-left.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); // Page language is Arabic.
    await expect.poll(async () => arabicShare(await page.locator('body').innerText()), { timeout: 20_000 }) // Most letters on the page
      .toBeGreaterThan(0.5); // are Arabic.
    // Wait until the banner itself has been redrawn in Arabic (titles), then check its details.
    await expect.poll(async () => arabicShare((await bannerMovies(page)).map((movie) => movie.title).join(' ')), { timeout: 20_000 })
      .toBeGreaterThan(0.5);
    await page.waitForTimeout(1_000); // Give the genre / language lines a moment to update too.
    const banner = await bannerMovies(page); // Banner movies in Arabic.
    for (const movie of banner) { // None may show "null" instead of a translated value.
      expect.soft(`${movie.language} ${movie.genre}`, `Arabic homepage: "${movie.title}" should not show "NULL"`).not.toMatch(/\bnull\b/i);
    }
  });

  await step('Check the Movies page tabs are in Arabic', async () => {
    await page.goto(new URL('/movies', testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open Movies (still Arabic).
    await expect(moviesTabs(page)).toBeVisible({ timeout: 90_000 }); // Wait for the tabs.
    expect(arabicShare(await moviesTabs(page).innerText()), 'Movies page tabs should be in Arabic').toBeGreaterThan(0.8); // Tab names in Arabic.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); // Still right-to-left.
  });

  await step('Check a movie page shows its detail labels in Arabic', async () => {
    const href = (await loadedMovieCards(page))[0].href; // Link of the first movie on the page.
    await page.goto(new URL(href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open it.
    await expect(page.locator('.movie-info-box').first()).toBeVisible({ timeout: 60_000 }); // Wait for the details.
    const labels = await page.locator('.movie-info-box p:first-child').allInnerTexts(); // Labels (Language, Genre, Director...).
    for (const label of labels) expect.soft(arabicShare(label), `Movie page label "${label}" should be Arabic`).toBeGreaterThan(0.5); // Each in Arabic.
  });

  await step('Check the SIGN IN dialog is in Arabic', async () => {
    await home.profileControl.click(); // Click the profile icon.
    await expect(home.profileDialog).toBeVisible(); // The sign-in dialog opens.
    expect(arabicShare(await home.profileDialog.innerText()), 'The sign-in dialog should be in Arabic').toBeGreaterThan(0.5); // Arabic text.
    await home.closeProfile(); // Close it.
  });

  await step('Switch back to English and check the text returns to English', async () => {
    await switchLanguage(page, 'en'); // Click "EN"; the page turns left-to-right.
    await expect.poll(async () => arabicShare(await page.locator('body').innerText()), { timeout: 20_000 }) // Arabic letters
      .toBeLessThan(0.3); // are now the exception.
  });
});
