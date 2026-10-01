// WEB-15 Events & Promotions - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import type { Locator } from '@playwright/test'; // Type for page elements (used in helper signatures).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header and sections.
import { // Helpers shared by the website tests (see pages/WebSite.ts):
  MOVIES_TABS, arabicShare, bannerMovies, brokenImages, kuwaitMinutesNow, loadedMovieCards, minutesOf, movieCards, moviesTabs,
  openHome, openMovies, openMoviesTab, sameTitle, scrollThrough, switchLanguage, titleRegExp,
} from '../pages/WebSite';

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

test('WEB-15 Events & Promotions', async ({ page, step, testConfig }) => {
  let promotionTitle = ''; // Title of the first promotion, checked on its details page.
  let promotionCount = 0; // Number of promotions, compared with the footer link's list.
  await step('Open EVENTS & PROMOTIONS > VIEW ALL from the homepage', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    const section = page.locator('section.promotions'); // The EVENTS & PROMOTIONS section.
    await expect(section.locator('h3')).toHaveText(/Events & Promotions/i); // Its heading.
    await section.locator('a[href="/promotion"]').first().click(); // Click VIEW ALL.
    await expect(page).toHaveURL(/\/promotion$/); // The promotions page opens.
  });

  await step('Check PROMOTION & EVENTS lists the promotions with their text', async () => {
    await expect(page.getByText(/promotion & events/i).first()).toBeVisible({ timeout: 30_000 }); // Page heading.
    const promotions = page.locator('a[href^="/promotion/"]').filter({ visible: true }); // One link per promotion.
    await expect(promotions.first()).toBeVisible({ timeout: 30_000 }); // At least one promotion is listed.
    promotionCount = await promotions.count(); // Remember how many.
    promotionTitle = (await promotions.first().innerText()).split('\n')[0].trim(); // First line = the promotion title.
    expect(promotionTitle, 'Each promotion should have a title').not.toBe(''); // It has a title.
  });

  await step('Open a promotion and check its details page', async () => {
    await page.locator('a[href^="/promotion/"]').filter({ visible: true }).first().click(); // Open the first promotion.
    await expect(page).toHaveURL(/\/promotion\/\d+/); // Its details page opens (/promotion/<number>).
    await expect(page.locator('body')).toContainText(promotionTitle, { timeout: 30_000 }); // It shows the same title.
    await page.goBack(); // Browser Back.
    await expect(page).toHaveURL(/\/promotion$/); // Back on the promotions list.
  });

  await step('Open the footer PROMOTIONS link and check it shows the same list', async () => {
    await page.locator('footer:not(.footer-mobile):visible a').filter({ hasText: /^promotions$/i }).first().click(); // Footer link.
    await expect(page).toHaveURL(/\/promotion$/); // Same promotions page.
    await expect(page.locator('a[href^="/promotion/"]').filter({ visible: true })).toHaveCount(promotionCount, { timeout: 30_000 }); // Same number.
  });

  await step('Switch to Arabic and check the promotions page is in Arabic', async () => {
    await switchLanguage(page, 'ar'); // Arabic (page turns right-to-left).
    await expect.poll(async () => arabicShare(await page.locator('body').innerText()), { timeout: 20_000 }) // Share of Arabic letters on the page
      .toBeGreaterThan(0.3); // is clearly present (the test promotion text itself is partly English).
    await switchLanguage(page, 'en'); // Back to English.
  });
});
