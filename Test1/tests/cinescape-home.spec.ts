import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinescape demo booking flow reaches date and time selection', async ({ page, testConfig }, testInfo) => {
  const homePage = new HomePage(page);

  await test.step('Open the Cinescape home page', async () => {
    await homePage.open(testConfig.urls.home);
  });

  await test.step('Verify the home page is ready', async () => {
    await expect(page).toHaveTitle(/Cinescape/i);
    await homePage.expectLoaded();
    await testInfo.attach('01-home-page-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Open the first movie session', async () => {
    await homePage.prepareFirstMovieSessionSelection();
    await testInfo.attach('02-book-now-selected-before-click', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.openFirstMovieSession();
  });

  await test.step('Verify date and time selection is available', async () => {
    await expect(page.getByRole('heading', { name: 'Select Date & Time' })).toBeVisible();
    await expect(page).toHaveURL(/\/moviesessions\//);
    await testInfo.attach('03-date-and-time-selection-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
