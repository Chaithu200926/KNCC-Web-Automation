// WEB-02 Homepage footer links navigation - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Checks the three footer headings, the SIGN IN / REGISTER links, every MORE LINKS page, the two app-store links
// and the four social media links. Each link is clicked, its destination is checked, and the test returns home.
import { test, expect } from './fixtures'; // Shared test setup: gives each test the `testConfig` settings.
import { HomePage } from '../pages/HomePage'; // Page object for the homepage (open, highlight, profile dialog).

// Slow every browser action down by 200 ms so the recorded video is easy to follow.
test.use({ launchOptions: { slowMo: 200 } });

test('WEB-02 Homepage footer links navigation', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(300_000); // 17 links, each opened and the homepage reloaded after it: up to 5 minutes on the slow UAT site.
  const homePage = new HomePage(page); // Helper object for the homepage.
  const footer = page.locator('footer:not(.footer-mobile):visible'); // The desktop footer (the mobile copy is hidden).
  // MORE LINKS: link text as shown, and the page each one should open on this site.
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
  // DOWNLOAD OUR MOBILE APP: the exact store addresses the links must point to.
  const appLinks = [
    { name: 'GOOGLE PLAY', href: 'https://play.google.com/store/apps/details?id=com.cinescape&hl=en_IN' },
    { name: 'APP STORE', href: 'https://apps.apple.com/in/app/cinescape-kncc/id443396586' },
  ];
  // SOCIAL MEDIA: the exact Cinescape pages the icons must point to.
  const socialLinks = [
    { name: 'FACEBOOK', href: 'https://www.facebook.com/CinescapeKuwait' },
    { name: 'INSTAGRAM', href: 'https://www.instagram.com/cinescapekuwait/' },
    { name: 'TWITTER', href: 'https://twitter.com/Cinescapekuwait' },
    { name: 'YOUTUBE', href: 'https://www.youtube.com/@CinescapeKuwait' },
  ];

  // Outline an element with a label on screen, then attach a full-page screenshot under `name` (for the dashboard).
  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-'); // "NOW SHOWING" → "now-showing" (screenshot names).
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Use text literally inside a pattern.
  // Scroll a link into the middle of the screen. Icon links have no size of their own, so scroll their nearest sized parent.
  const scrollTargetIntoView = async (locator: Parameters<HomePage['highlight']>[0]) => {
    await locator.evaluate((element) => {
      let target = element as HTMLElement;
      while (target.parentElement && (target.getBoundingClientRect().width === 0 || target.getBoundingClientRect().height === 0)) {
        target = target.parentElement; // Walk up until an element with a visible size.
      }
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  };
  // Reopen the homepage after a link, check it loaded, and take a "returned" screenshot.
  const returnHome = async (step: number, name: string, snapshotName = name) => {
    await homePage.open(testConfig.urls.home); // Back to the homepage.
    await expect(page).toHaveURL(/uatweb\.cinescape\.com\.kw\/?$/); // Exactly the homepage address.
    await expect(homePage.logo).toBeVisible(); // Page loaded.
    await captureStep(
      `footer-${String(step).padStart(2, '0')}-${slug(snapshotName)}-returned`,
      homePage.logo,
      `STEP ${step} - HOMEPAGE RESTORED AFTER ${name}`,
    );
  };

  // Click a footer link that opens another website in a new tab, check that tab's address, then close it.
  const verifyExternalLink = async (step: number, linkName: string, href: string, section: string) => {
    const link = footer.locator(`a:visible[href="${href}"]`).first(); // The link with exactly this address.
    await test.step(`Click and verify footer ${section} ${linkName}`, async () => {
      await expect(link).toBeVisible(); // The link is shown (so its address is also correct).
      await scrollTargetIntoView(link);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(section)}-${slug(linkName)}-click`,
        link,
        `STEP ${step} - CLICK FOOTER ${section} ${linkName}`,
      );

      const popupPromise = page.waitForEvent('popup'); // Start listening for the new tab before clicking.
      await link.click(); // Open the link.
      const popup = await popupPromise; // The new tab.
      const popupVideo = popup.video(); // Its recording (deleted below; only the main page video is kept).
      try {
        await popup.waitForLoadState('domcontentloaded').catch(() => undefined); // Let it start loading (some sites never finish).
        // The new tab should be on the expected site (Twitter now redirects to x.com).
        const expectedHost = href.includes('twitter.com') ? '(?:twitter\\.com|x\\.com)' : escapeRegExp(new URL(href).hostname);
        await expect(popup).toHaveURL(new RegExp(expectedHost));
        await testInfo.attach(`footer-${String(step).padStart(2, '0')}-${slug(section)}-${slug(linkName)}-landed`, { // Screenshot of that site.
          body: await popup.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      } finally {
        await popup.close(); // Always close the extra tab
        await popupVideo?.delete(); // and drop its video.
      }
      await returnHome(step, linkName, `${section} ${linkName}`); // Back to the homepage.
    });
  };

  await homePage.open(testConfig.urls.home); // Load the homepage.
  await expect(page).toHaveTitle(/Cinescape/i); // It is the Cinescape site.
  await expect(footer).toBeVisible(); // The footer is shown.

  // Steps 1-3: the three footer headings.
  for (const [index, headingName] of ['MORE LINKS', 'DOWNLOAD OUR MOBILE APP', 'SOCIAL MEDIA'].entries()) {
    const step = index + 1;
    await test.step(`Verify footer header ${headingName}`, async () => {
      const heading = footer.getByRole('heading', { name: new RegExp(`^${headingName}$`, 'i') }).first();
      await expect(heading).toBeVisible(); // Heading shown.
      await captureStep(
        `footer-header-${slug(headingName)}`,
        heading,
        `STEP ${step} - FOOTER HEADER ${headingName} VERIFIED`,
      );
    });
  }

  // Steps 4-5: SIGN IN and REGISTER open the sign-in / sign-up dialog (nothing is submitted).
  for (const [index, controlName] of ['SIGN IN', 'REGISTER'].entries()) {
    const step = index + 4;
    await test.step(`Verify footer ${controlName} button`, async () => {
      const control = footer.locator('a:visible').filter({ hasText: new RegExp(`^${controlName}$`, 'i') }).first();
      await expect(control).toBeVisible(); // Link shown.
      await scrollTargetIntoView(control);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(controlName)}-click`,
        control,
        `STEP ${step} - CLICK FOOTER ${controlName}`,
      );
      await control.click(); // Open it.
      await expect(homePage.profileDialog).toBeVisible(); // A dialog opens:
      await expect(homePage.profileDialog).toContainText(new RegExp(controlName === 'SIGN IN' ? 'Sign in' : 'Sign up', 'i')); // SIGN IN or SIGN UP.
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(controlName)}-landed`,
        homePage.profileDialog,
        `STEP ${step} - FOOTER ${controlName} DIALOG VERIFIED`,
      );
      await homePage.closeProfile(); // Close the dialog.
      await returnHome(step, controlName); // Back to the homepage.
    });
  }

  // Steps 6-14: each MORE LINKS link opens the right page on this site.
  for (const [index, footerLink] of footerLinks.entries()) {
    const step = index + 6;
    const link = footer.locator('a:visible').filter({ hasText: new RegExp(`^${footerLink.name}$`, 'i') }).first(); // The link by its text.
    const destination = new URL(footerLink.path, testConfig.urls.home).toString(); // Full expected address.
    const destinationPattern = new RegExp(`${destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`); // That address (optional trailing /).

    await test.step(`Click and verify footer ${footerLink.name}`, async () => {
      await expect(link).toBeVisible(); // Link shown.
      await scrollTargetIntoView(link);
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(footerLink.name)}-click`,
        link,
        `STEP ${step} - CLICK FOOTER ${footerLink.name}`,
      );

      await link.click(); // Open it.
      await expect(page).toHaveURL(destinationPattern); // The expected page opened.
      await expect(page).toHaveTitle(/Cinescape/i); // Still the Cinescape site.
      await captureStep(
        `footer-${String(step).padStart(2, '0')}-${slug(footerLink.name)}-landed`,
        page.locator('body'),
        `STEP ${step} - FOOTER ${footerLink.name} DESTINATION VERIFIED`,
      );

      await returnHome(step, footerLink.name); // Back to the homepage.
    });
  }

  // Steps 15-16: Google Play and App Store open in a new tab.
  for (const [index, appLink] of appLinks.entries()) {
    await verifyExternalLink(index + 15, appLink.name, appLink.href, 'DOWNLOAD OUR MOBILE APP');
  }

  // Steps 17-20: Facebook, Instagram, Twitter (X) and YouTube open in a new tab.
  for (const [index, socialLink] of socialLinks.entries()) {
    await verifyExternalLink(index + 17, socialLink.name, socialLink.href, 'SOCIAL MEDIA');
  }
});
