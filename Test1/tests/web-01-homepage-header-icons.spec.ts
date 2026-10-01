// WEB-01 Homepage header icons - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Opens the homepage and clicks each header control in turn: logo, SEARCH, the Arabic / English switch,
// the profile icon (SIGN IN dialog) and MENU. Nothing is signed in or saved.
import { test, expect } from './fixtures'; // Shared test setup: gives each test the `testConfig` settings.
import { HomePage } from '../pages/HomePage'; // Page object for the homepage header (logo, search, language, profile, menu).

// Slow every browser action down by 200 ms so the recorded video is easy to follow.
test.use({ launchOptions: { slowMo: 200 } });

test('WEB-01 Homepage header icons', async ({ page, testConfig }, testInfo) => {
  const homePage = new HomePage(page); // Helper object for the homepage header.

  await test.step('Load the Cinescape homepage', async () => {
    await homePage.open(testConfig.urls.home); // Go to the UAT homepage.
  });

  await test.step('Verify the homepage is available', async () => {
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/); // The UAT site address.
    await expect(page).toHaveTitle(/Cinescape/i); // Browser tab title mentions Cinescape.
    await expect(homePage.logo).toBeVisible(); // The Cinescape logo is shown.
    await homePage.highlight(homePage.logo, 'STEP 1 - URL VERIFIED: ' + page.url()); // Outline the logo and label the step on screen.
    await testInfo.attach('homepage-loaded', { // Screenshot for the report / dashboard.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Verify the Cinescape header', async () => {
    await expect(homePage.logo).toBeVisible(); // Header logo still shown.
    await homePage.highlight(homePage.logo, 'STEP 2 - CINESCAPE HEADER VERIFIED'); // Label the step on screen.
    await testInfo.attach('header-cinescape-verified', { // Screenshot.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify Search', async () => {
    await expect(homePage.searchControl).toBeVisible(); // SEARCH is shown in the header.
    await homePage.highlight(homePage.searchControl, 'STEP 3 - SEARCH CONTROL'); // Label it.
    await testInfo.attach('search-control-before-click', { // Screenshot before clicking.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.searchControl.click(); // Open the search box.
    await expect(homePage.searchInput).toBeVisible(); // The search box appears.
    await homePage.highlight(homePage.searchInput, 'STEP 4 - SEARCH EXPANDED'); // Label it.
    await testInfo.attach('search-expanded', { // Screenshot with the search box open.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.closeSearch(); // Close the search box again.
    await homePage.highlight(homePage.searchControl, 'STEP 5 - SEARCH CLOSED'); // Label it.
    await testInfo.attach('search-closed', { // Screenshot after closing.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click Arabic button and verify the Arabic homepage', async () => {
    await expect(homePage.languageControl).toBeVisible(); // The language switch is shown.
    await expect(homePage.languageButton).toBeAttached(); // Its Arabic button is on the page.
    await homePage.highlight(homePage.languageControl, 'STEP 6 - CLICK ARABIC BUTTON'); // Label it.
    await testInfo.attach('language-control-before-click', { // Screenshot before switching.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.languageButton.click(); // Switch to Arabic.
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/); // Still on the UAT site.
    await expect(page.locator('body')).toContainText('بحث', { timeout: 30_000 }); // "Search" in Arabic (the Arabic page can take a while on UAT).
    await expect(page.locator('body')).toContainText('القائمة'); // "Menu" in Arabic.
    await expect(homePage.englishControl).toHaveText('EN'); // The switch now offers English.
    await homePage.highlight(homePage.englishControl, 'STEP 7 - ARABIC HOMEPAGE VERIFIED'); // Label it.
    await testInfo.attach('arabic-homepage-verified', { // Screenshot of the Arabic homepage.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Return to English homepage', async () => {
    await homePage.englishControl.click(); // Switch back to English.
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/); // Still on the UAT site.
    await expect(homePage.searchControl).toContainText('SEARCH'); // Header text is English again.
    await expect(homePage.menuControl).toContainText('MENU');
    await homePage.highlight(homePage.logo, 'STEP 8 - ENGLISH HOMEPAGE RESTORED'); // Label it.
    await testInfo.attach('english-homepage-restored', { // Screenshot.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify My Profile', async () => {
    await homePage.highlight(homePage.profileControl, 'STEP 9 - MY PROFILE CONTROL'); // Label the profile icon.
    await homePage.profileControl.click(); // Click the profile icon.
    await expect(homePage.profileDialog).toBeVisible(); // A dialog opens
    await expect(homePage.profileDialog).toContainText(/Sign in/i); // asking the user to sign in.
    await homePage.highlight(homePage.profileDialog, 'STEP 10 - MY PROFILE SIGN-IN VERIFIED'); // Label it.
    await testInfo.attach('profile-sign-in-dialog', { // Screenshot of the SIGN IN dialog.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.closeProfile(); // Close the dialog.
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw/); // Back on the homepage.
    await homePage.highlight(homePage.logo, 'STEP 10 - RETURNED TO HOMEPAGE'); // Label it.
    await testInfo.attach('returned-to-homepage', { // Screenshot.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  await test.step('Click and verify Menu', async () => {
    await homePage.highlight(homePage.menuControl, 'STEP 11 - MENU CONTROL'); // Label MENU.
    await homePage.menuControl.click(); // Open the menu.
    await expect(homePage.menuPanel.locator('a').filter({ hasText: /^HOME$/i }).first()).toBeAttached(); // The menu lists HOME.
    await homePage.highlight(homePage.menuPanel, 'STEP 12 - MENU NAVIGATION VERIFIED'); // Label it.
    await testInfo.attach('menu-opened', { // Screenshot with the menu open.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await homePage.menuControl.click(); // Close the menu.
    await homePage.highlight(homePage.logo, 'STEP 13 - MENU CLOSED, HOMEPAGE RESTORED'); // Label it.
    await testInfo.attach('menu-closed', { // Screenshot after closing.
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
