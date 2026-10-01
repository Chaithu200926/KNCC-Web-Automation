// WEB-20 Watch trailer - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-20 Watch trailer', async ({ page, step, testConfig }) => {
  const trailerDialog = page.locator('[role="dialog"]:visible').last(); // The trailer pop-up.
  // Click WATCH TRAILER until the player opens, then check it is a YouTube video and close it.
  const openAndCloseTrailer = async (trigger: Locator) => {
    await expect(async () => { // Retry for up to 30 s:
      // The click handler sits on the link around the play icon and the text, so click that link directly
      // (a direct click also works while the homepage carousel is sliding).
      await trigger.evaluate((element) => ((element.closest('a') ?? element.querySelector('a') ?? element) as HTMLElement).click());
      await expect(trailerDialog.locator('iframe')).toBeVisible({ timeout: 5_000 }); // The video player appears.
    }).toPass({ timeout: 30_000 });
    await expect(trailerDialog.locator('iframe')).toHaveAttribute('src', /youtube\.com\/embed\/[\w-]+/); // It plays a YouTube video.
    await trailerDialog.locator('button.trailer-video-cross, button.trailer-cross').first().click(); // Close it with X.
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0); // The pop-up is gone.
  };

  await step('Open WATCH TRAILER on a homepage movie and close it', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await openAndCloseTrailer(page.locator('.banner-item .banner-trailer').filter({ visible: true }).first()); // Banner WATCH TRAILER.
  });

  await step('Open WATCH TRAILER on a movie page and close it', async () => {
    const href = (await bannerMovies(page))[0].bookNow; // Link of the first banner movie.
    await page.goto(new URL(href, testConfig.urls.home).toString(), { waitUntil: 'commit' }); // Open its movie page.
    // Clicking WATCH TRAILER before the movie data has loaded blanks the page ("reading 'split'"), so wait for the details first.
    await expect.poll(async () => ((await page.locator('.movie-info-box p:nth-child(2)').first().textContent()) ?? '').trim(), { timeout: 60_000 })
      .not.toBe(''); // The first detail value (language) is filled in.
    await page.waitForTimeout(3_000); // And give the rest of the movie data a moment.
    await openAndCloseTrailer(page.getByText(/watch trailer/i).filter({ visible: true }).first()); // Movie page WATCH TRAILER.
  });
});
