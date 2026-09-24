import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test.use({ video: 'off' });

test('Homepage footer links navigation validation', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(180_000);
  const homePage = new HomePage(page);
  const footer = page.locator('footer:not(.footer-mobile):visible');
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
  const appLinks = [
    { name: 'GOOGLE PLAY', href: 'https://play.google.com/store/apps/details?id=com.cinescape&hl=en_IN' },
    { name: 'APP STORE', href: 'https://apps.apple.com/in/app/cinescape-kncc/id443396586' },
  ];
  const socialLinks = [
    { name: 'FACEBOOK', href: 'https://www.facebook.com/CinescapeKuwait' },
    { name: 'INSTAGRAM', href: 'https://www.instagram.com/cinescapekuwait/' },
    { name: 'TWITTER', href: 'https://twitter.com/Cinescapekuwait' },
    { name: 'YOUTUBE', href: 'https://www.youtube.com/@CinescapeKuwait' },
  ];

  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scrollTargetIntoView = async (locator: Parameters<HomePage['highlight']>[0]) => {
    await locator.evaluate((element) => {
      let target = element as HTMLElement;
      while (target.parentElement && (target.getBoundingClientRect().width === 0 || target.getBoundingClientRect().height === 0)) {
        target = target.parentElement;
      }
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  };
  const returnHome = async (step: number, name: string, snapshotName = name) => {
    await homePage.open(testConfig.urls.home);
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw\/?$/);
    await expect(homePage.logo).toBeVisible();
    await captureStep(
      `footer-${String(step).padStart(2, '0')}-${slug(snapshotName)}-returned`,
      homePage.logo,
      `STEP ${step} - HOMEPAGE RESTORED AFTER ${name}`,
    );
  };

  const verifyExternalLink = async (step: number, linkName: string, href: string, section: string) => {
    const link = footer.locator(`a:visible[href="${href}"]`).first();
    await test.step(`Click and verify footer ${section} ${linkName}`, async () => {
      await expect(link).toBeVisible();
      await scrollTargetIntoView(link);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(section)}-${slug(linkName)}-click`,
        link,
        `STEP ${step} - CLICK FOOTER ${section} ${linkName}`,
      );

      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
      const expectedHost = href.includes('twitter.com') ? '(?:twitter\\.com|x\\.com)' : escapeRegExp(new URL(href).hostname);
      await expect(popup).toHaveURL(new RegExp(expectedHost));
      await testInfo.attach(`footer-${String(step).padStart(2, '0')}-${slug(section)}-${slug(linkName)}-landed`, {
        body: await popup.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      await popup.close();
      await returnHome(step, linkName, `${section} ${linkName}`);
    });
  };

  await homePage.open(testConfig.urls.home);
  await expect(page).toHaveTitle(/Cinescape/i);
  await expect(footer).toBeVisible();

  for (const [index, headingName] of ['MORE LINKS', 'DOWNLOAD OUR MOBILE APP', 'SOCIAL MEDIA'].entries()) {
    const step = index + 1;
    await test.step(`Verify footer header ${headingName}`, async () => {
      const heading = footer.getByRole('heading', { name: new RegExp(`^${headingName}$`, 'i') }).first();
      await expect(heading).toBeVisible();
      await captureStep(
        `footer-header-${slug(headingName)}`,
        heading,
        `STEP ${step} - FOOTER HEADER ${headingName} VERIFIED`,
      );
    });
  }

  for (const [index, controlName] of ['SIGN IN', 'REGISTER'].entries()) {
    const step = index + 4;
    await test.step(`Verify footer ${controlName} button`, async () => {
      const control = footer.locator('a:visible').filter({ hasText: new RegExp(`^${controlName}$`, 'i') }).first();
      await expect(control).toBeVisible();
      await scrollTargetIntoView(control);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(controlName)}-click`,
        control,
        `STEP ${step} - CLICK FOOTER ${controlName}`,
      );
      await control.click();
      await expect(homePage.profileDialog).toBeVisible();
      await expect(homePage.profileDialog).toContainText(new RegExp(controlName === 'SIGN IN' ? 'Sign in' : 'Sign up', 'i'));
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(controlName)}-landed`,
        homePage.profileDialog,
        `STEP ${step} - FOOTER ${controlName} DIALOG VERIFIED`,
      );
      await homePage.closeProfile();
      await returnHome(step, controlName);
    });
  }

  for (const [index, footerLink] of footerLinks.entries()) {
    const step = index + 6;
    const link = footer.locator('a:visible').filter({ hasText: new RegExp(`^${footerLink.name}$`, 'i') }).first();
    const destination = new URL(footerLink.path, testConfig.urls.home).toString();
    const destinationPattern = new RegExp(`${destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`);

    await test.step(`Click and verify footer ${footerLink.name}`, async () => {
      await expect(link).toBeVisible();
      await scrollTargetIntoView(link);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(footerLink.name)}-click`,
        link,
        `STEP ${step} - CLICK FOOTER ${footerLink.name}`,
      );

      await link.click();
      await expect(page).toHaveURL(destinationPattern);
      await expect(page).toHaveTitle(/Cinescape/i);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(footerLink.name)}-landed`,
        page.locator('body'),
        `STEP ${step} - FOOTER ${footerLink.name} DESTINATION VERIFIED`,
      );

      await returnHome(step, footerLink.name);
    });
  }

  for (const [index, appLink] of appLinks.entries()) {
    await verifyExternalLink(index + 15, appLink.name, appLink.href, 'DOWNLOAD OUR MOBILE APP');
  }

  for (const [index, socialLink] of socialLinks.entries()) {
    await verifyExternalLink(index + 17, socialLink.name, socialLink.href, 'SOCIAL MEDIA');
  }
});
