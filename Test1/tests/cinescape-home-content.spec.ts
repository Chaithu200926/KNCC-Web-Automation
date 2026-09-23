import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinescape homepage displays navigation, movies, and content sections', async ({ page, testConfig }) => {
  const homePage = new HomePage(page);

  await test.step('Open the Cinescape homepage', async () => {
    await homePage.open(testConfig.urls.home);
    await expect(page).toHaveTitle(/Cinescape/i);
  });

  await test.step('Verify the homepage is loaded', async () => {
    await homePage.expectLoaded();
  });

  await test.step('Verify static navigation headers', async () => {
    await homePage.expectStaticNavigation();
  });

  await test.step('Verify movies are displayed', async () => {
    await homePage.expectHomepageContent();
  });
});