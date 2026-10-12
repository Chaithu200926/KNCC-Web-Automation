// WEB-46 Browsers and screen sizes - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. Opens the main pages on a phone, a tablet and a desktop screen and checks
// each page fits the screen (no sideways scrolling), the header logo shows and the MENU opens.
// Other browsers (Firefox, Safari) are not part of this run: Firefox is blocked on the QA PC (Windows policy).
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { devices, type Page } from '@playwright/test'; // Phone and tablet settings; page type.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { openHome } from './pages/WebSite'; // Opens the homepage and waits for the movie list.

test.describe.configure({ timeout: 360_000 }); // Up to 6 minutes (three screens x five pages on the slow UAT site).

const SCREENS = [ // Name, device settings.
  { name: 'Phone (iPhone 13)', use: devices['iPhone 13'] },
  { name: 'Tablet (iPad Mini)', use: devices['iPad Mini'] },
  { name: 'Desktop (1920 x 1080)', use: { viewport: { width: 1920, height: 1080 } } },
];
const PAGES = ['/', '/movies', '/locations', '/promotion', '/contactus']; // Plus one movie page (found on the homepage).

/** How many pixels the page is wider than the screen (0 = fits). */
const overflow = (page: Page) => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));

test('WEB-46 Browsers and screen sizes', async ({ browser, step, testConfig }, testInfo) => {
  for (const screen of SCREENS) {
    await step(`${screen.name}: open the main pages and check each fits the screen, shows the logo and opens MENU`, async () => {
      const context = await browser.newContext({ ...screen.use, serviceWorkers: 'block' }); // New private window with this screen.
      const page = await context.newPage();
      try {
        await openHome(page, testConfig.urls.home); // Homepage first (also finds a movie page).
        const movie = await page.locator('a[href*="/moviesessions/"]').first().getAttribute('href'); // First movie's page.
        const results: string[] = [];
        for (const path of [...PAGES, movie ?? '/']) {
          await page.goto(new URL(path, testConfig.urls.home).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
          await expect(page.locator('nav.header-nav').first(), `${path}: the header should show`).toBeVisible({ timeout: 30_000 });
          await page.waitForTimeout(2_000); // Let images and lists settle.
          const extra = await overflow(page);
          results.push(`${path}: ${extra ? `${extra}px too wide` : 'fits'}`);
          expect.soft(extra, `${screen.name} ${path}: the page should fit the screen (no sideways scrolling)`).toBeLessThanOrEqual(2);
          await expect.soft(page.locator('nav.header-nav img').filter({ visible: true }).first(), `${screen.name} ${path}: the logo should show`).toBeVisible();
        }
        testInfo.annotations.push({ type: screen.name, description: results.join('; ') });
        await page.goto(testConfig.urls.home, { waitUntil: 'domcontentloaded' }); // MENU on the homepage.
        await page.locator('nav.header-nav .nav-menu.pointer-cursor:visible').first().click(); // MENU.
        await expect.soft(page.locator('a').filter({ hasText: /^promotions$/i }).filter({ visible: true }).first(),
          `${screen.name}: MENU should open and list PROMOTIONS`).toBeVisible({ timeout: 15_000 });
        await testInfo.attach(`${screen.name} menu`, { body: await page.screenshot(), contentType: 'image/png' });
      } finally {
        await context.close();
      }
    });
  }
});
