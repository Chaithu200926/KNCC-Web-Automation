import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test.use({ video: 'off' });

test('Homepage header icons', async ({ page, testConfig }, testInfo) => {
  const homePage = new HomePage(page);

  await test.step('Load the Cinescape homepage', async () => {
    await homePage.open(testConfig.urls.home);
  });

  await test.step('Verify the homepage is available', async () => {
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/);
    await expect(page).toHaveTitle(/Cinescape/i);
    await expect(homePage.logo).toBeVisible();
    await homePage.highlight(homePage.logo, 'STEP 1 - URL VERIFIED: ' + page.url());
    await testInfo.attach('homepage-loaded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Verify the Cinescape header', async () => {
    await expect(homePage.logo).toBeVisible();
    await homePage.highlight(homePage.logo, 'STEP 2 - CINESCAPE HEADER VERIFIED');
    await testInfo.attach('header-cinescape-verified', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify Search', async () => {
    await expect(homePage.searchControl).toBeVisible();
    await homePage.highlight(homePage.searchControl, 'STEP 3 - SEARCH CONTROL');
    await testInfo.attach('search-control-before-click', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.searchControl.click();
    await expect(homePage.searchInput).toBeVisible();
    await homePage.highlight(homePage.searchInput, 'STEP 4 - SEARCH EXPANDED');
    await testInfo.attach('search-expanded', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.closeSearch();
    await homePage.highlight(homePage.searchControl, 'STEP 5 - SEARCH CLOSED');
    await testInfo.attach('search-closed', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click Arabic button and verify the Arabic homepage', async () => {
    await expect(homePage.languageControl).toBeVisible();
    await expect(homePage.languageButton).toBeAttached();
    await homePage.highlight(homePage.languageControl, 'STEP 6 - CLICK ARABIC BUTTON');
    await testInfo.attach('language-control-before-click', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.languageButton.click();
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/);
    await expect(page.locator('body')).toContainText('بحث');
    await expect(page.locator('body')).toContainText('القائمة');
    await expect(homePage.englishControl).toHaveText('EN');
    await homePage.highlight(homePage.englishControl, 'STEP 7 - ARABIC HOMEPAGE VERIFIED');
    await testInfo.attach('arabic-homepage-verified', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Return to English homepage', async () => {
    await homePage.englishControl.click();
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/);
    await expect(homePage.searchControl).toContainText('SEARCH');
    await expect(homePage.menuControl).toContainText('MENU');
    await homePage.highlight(homePage.logo, 'STEP 8 - ENGLISH HOMEPAGE RESTORED');
    await testInfo.attach('english-homepage-restored', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify My Profile', async () => {
    await homePage.highlight(homePage.profileControl, 'STEP 9 - MY PROFILE CONTROL');
    await homePage.profileControl.click();
    await expect(homePage.profileDialog).toBeVisible();
    await expect(homePage.profileDialog).toContainText(/Sign in/i);
    await homePage.highlight(homePage.profileDialog, 'STEP 10 - MY PROFILE SIGN-IN VERIFIED');
    await testInfo.attach('profile-sign-in-dialog', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.closeProfile();
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/);
    await homePage.highlight(homePage.logo, 'STEP 10 - RETURNED TO HOMEPAGE');
    await testInfo.attach('returned-to-homepage', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify Menu', async () => {
    await homePage.highlight(homePage.menuControl, 'STEP 11 - MENU CONTROL');
    await homePage.menuControl.click();
    await expect(homePage.menuPanel.locator('a').filter({ hasText: /^HOME$/i }).first()).toBeAttached();
    await homePage.highlight(homePage.menuPanel, 'STEP 12 - MENU NAVIGATION VERIFIED');
    await testInfo.attach('menu-opened', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.menuControl.click();
    await homePage.highlight(homePage.logo, 'STEP 13 - MENU CLOSED, HOMEPAGE RESTORED');
    await testInfo.attach('menu-closed', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
