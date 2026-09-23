import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinescape homepage displays navigation, movies, and content sections', async ({ page, testConfig }, testInfo) => {
  const homePage = new HomePage(page);

  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  await test.step('Open the Cinescape homepage', async () => {
    await homePage.open(testConfig.urls.home);
    await expect(page).toHaveTitle(/Cinescape/i);
    await captureStep('01-homepage-loaded', homePage.logo, 'STEP 1 - HOMEPAGE LOADED');
  });

  await test.step('Verify the homepage is loaded', async () => {
    await homePage.expectLoaded();
    await captureStep('02-homepage-ready', homePage.logo, 'STEP 2 - LOGO AND MOVIE AREA VERIFIED');
  });

  await test.step('Verify static navigation headers', async () => {
    await homePage.expectStaticNavigation();
    await captureStep('03-navigation-headers', homePage.header, 'STEP 3 - NAVIGATION HEADERS VERIFIED');
  });

  await test.step('Verify movies are displayed', async () => {
    await homePage.expectMoviesDisplayed();
    await captureStep('04-movies-displayed', homePage.bookNowLinks.first(), 'STEP 4 - MOVIES AND BOOK NOW VERIFIED');
  });

  await test.step('Verify Experiences content', async () => {
    await homePage.expectExperiencesDisplayed();
    await captureStep('05-experiences-section', homePage.experienceSection, 'STEP 5 - EXPERIENCES VERIFIED');
  });

  await test.step('Verify Cinescape Locations content', async () => {
    await homePage.expectLocationsDisplayed();
    await captureStep('06-locations-section', homePage.locationSection, 'STEP 6 - CINESCAPE LOCATIONS VERIFIED');
  });

  await test.step('Verify Events and Promotions content', async () => {
    await homePage.expectPromotionsDisplayed();
    await captureStep('07-promotions-section', homePage.promotionsSection, 'STEP 7 - EVENTS AND PROMOTIONS VERIFIED');
  });
});