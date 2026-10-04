// WEB-40 Cinema location map links - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// No sign-in; the test only reads the site. "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).
import { openHome } from '../pages/WebSite'; // Opens the homepage and waits for the movie list.

test.describe.configure({ timeout: 180_000 }); // The test may take up to 3 minutes (the UAT site can be slow).

/** "lat,lng" from a Google Maps address such as https://www.google.com/maps?q=29.2678,47.9919 (undefined if none). */
const mapsCoordinates = (url: string) => decodeURIComponent(url).match(/google\.[a-z.]+\/maps\S*?[?&]q=(-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)/i)?.[1];

test('WEB-40 Cinema location map links', async ({ page, step, testConfig }, testInfo) => {
  let popupPlace: string | undefined; // Coordinates shown by the Locations page map.

  await step('Open the footer LOCATIONS link and check the cinema is listed', async () => {
    await openHome(page, testConfig.urls.home); // Load the homepage.
    await page.locator('footer:not(.footer-mobile):visible a').filter({ hasText: /^locations$/i }).first().click(); // Footer LOCATIONS.
    await expect(page).toHaveURL(/\/locations$/); // Locations page.
    await expect(page.getByText(/^cinescape 360$/i).first()).toBeVisible({ timeout: 60_000 }); // Cinescape 360 is listed.
    const address = async () => (await page.locator('.location_info').first().innerText()).replace(/\b(?:location|maps)\b/gi, '').trim(); // Text under LOCATION.
    await expect.soft.poll(address, { message: 'The Locations page should show the cinema address under LOCATION', timeout: 20_000 })
      .not.toBe(''); // Given 20 s to load (seen empty on 30 Sep and 1 Oct 2026).
  });

  await step('Click Maps and check a pop-up shows a Google map of the cinema, then close it', async () => {
    await page.locator('p.map').filter({ hasText: /maps/i }).first().click(); // "Maps" under Cinescape 360.
    const popup = page.locator('[role="dialog"]:visible').last(); // The map pop-up.
    const map = popup.locator('iframe'); // Google map inside it.
    await expect(map).toBeVisible({ timeout: 15_000 });
    popupPlace = mapsCoordinates(await map.getAttribute('src') ?? ''); // Where the map points.
    expect(popupPlace, 'The pop-up should show a Google map at the cinema coordinates').toBeTruthy();
    await popup.locator('button.trailer-cross, button').first().click(); // Close with X.
    await expect(popup).toBeHidden();
  });

  await step('Open the Cinescape 360 cinema page and check its address and Maps link', async () => {
    await page.locator('a[href*="/cinemasessions/"]').first().click(); // Cinema picture = link to the cinema page.
    await expect(page).toHaveURL(/\/cinemasessions\//);
    const mapsLink = page.locator('a[href*="google."][href*="/maps"]').first(); // "Maps" link.
    // The link first reads "q=undefined,undefined" and gets the coordinates once the cinema data loads.
    await expect(mapsLink).toHaveAttribute('href', /[?&]q=-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/, { timeout: 30_000 });
    await expect(mapsLink).toHaveAttribute('target', '_blank'); // Opens in a new tab.
    expect.soft(mapsCoordinates(await mapsLink.getAttribute('href') ?? ''), 'Both maps should point to the same place').toBe(popupPlace);
    const address = (await mapsLink.locator('xpath=..').innerText()).replace(/\b(?:location|maps)\b/gi, '').trim(); // e.g. "360 Mall, Zahra".
    expect.soft(address, 'The cinema page should show the cinema address').not.toBe('');
  });

  await step('Click Maps and check Google Maps opens in a new tab', async () => {
    const newTab = page.waitForEvent('popup'); // Wait for the new tab.
    await page.locator('a[href*="google."][href*="/maps"]').first().click(); // Click Maps.
    const maps = await newTab; // The Google Maps tab.
    try {
      // Google may first show a cookie-consent page; its address still carries the maps link.
      await expect.poll(() => decodeURIComponent(maps.url()), { timeout: 30_000 }).toMatch(/google\.[a-z.]+\/maps/i);
      const shot = await maps.screenshot({ timeout: 15_000 }).catch(() => undefined); // Screenshot of the map (Google Maps can refuse it).
      if (shot) await testInfo.attach('Google Maps tab', { body: shot, contentType: 'image/png' });
    } finally {
      await maps.close(); // Close the tab.
      await page.bringToFront(); // Back to the Cinescape tab (for the step screenshot).
    }
  });
});
