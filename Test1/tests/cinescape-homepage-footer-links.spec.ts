import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Homepage footer links navigation validation', async ({ page, testConfig }, testInfo) => {
  const homePage = new HomePage(page);
  const footer = page.locator('footer:visible');
  const footerLinks = [
    { name: 'NOW SHOWING', path: '/movies' },
    { name: 'COMING SOON', path: '/movies?type=comingsoon' },
    { name: 'LOCATIONS', path: '/locations' },
    { name: 'FAQS', path: '/faq' },
    { name: 'CONTACT US', path: '/contactus' },
    { name: 'PROMOTIONS', path: '/promotion' },
    { name: 'TERMS AND CONDITIONS', path: '/terms' },
    { name: 'PRIVACY POLICY', path: '/privacypolicy' },
    { name: 'AGE RATING', path: '/agerating' },
  ];

  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  await homePage.open(testConfig.urls.home);
  await expect(page).toHaveTitle(/Cinescape/i);
  await expect(footer).toBeVisible();

  for (const [index, footerLink] of footerLinks.entries()) {
    const step = index + 1;
    const link = footer.getByRole('link', { name: new RegExp(`^${footerLink.name}$`, 'i') }).first();
    const destination = new URL(footerLink.path, testConfig.urls.home).toString();
    const destinationPattern = new RegExp(`${destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`);

    await test.step(`Click and verify footer ${footerLink.name}`, async () => {
      await expect(link).toBeVisible();
      await link.scrollIntoViewIfNeeded();
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${footerLink.name.toLowerCase().replaceAll(' ', '-')}-click`,
        link,
        `STEP ${step} - CLICK FOOTER ${footerLink.name}`,
      );

      await link.click();
      await expect(page).toHaveURL(destinationPattern);
      await expect(page).toHaveTitle(/Cinescape/i);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${footerLink.name.toLowerCase().replaceAll(' ', '-')}-landed`,
        page.locator('body'),
        `STEP ${step} - FOOTER ${footerLink.name} DESTINATION VERIFIED`,
      );

      await homePage.open(testConfig.urls.home);
      await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw\/?$/);
      await expect(homePage.logo).toBeVisible();
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${footerLink.name.toLowerCase().replaceAll(' ', '-')}-returned`,
        homePage.logo,
        `STEP ${step} - HOMEPAGE RESTORED AFTER ${footerLink.name}`,
      );
    });
  }
});
