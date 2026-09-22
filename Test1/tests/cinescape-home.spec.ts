import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';

test('Cinescape demo booking flow reaches date and time selection', async ({ page }, testInfo) => {
  const homePage = new HomePage(page);

  await test.step('Open the Cinescape home page', async () => {
    await homePage.open();
  });

  await test.step('Verify the home page is ready', async () => {
    await expect(page).toHaveTitle(/Cinescape/i);
    await homePage.expectLoaded();
    await testInfo.attach('01-home-page', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  await test.step('Open the first movie session', async () => {
    await homePage.openFirstMovieSession();
  });

  await test.step('Verify date and time selection is available', async () => {
    await expect(page.getByRole('heading', { name: 'Select Date & Time' })).toBeVisible();
    await testInfo.attach('02-date-and-time-selection', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
