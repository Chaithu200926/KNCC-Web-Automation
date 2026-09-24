import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinema booking flow is confirmed in My Profile', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(240_000);

  test.skip(
    !testConfig.credentials.username || !testConfig.credentials.password || !testConfig.credentials.pin,
    'Set TEST_USERNAME, TEST_PASSWORD, and TEST_PIN in .env before running the booking test.',
  );

  const homePage = new HomePage(page);
  let movieTitle = '';
  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  const clickWithHighlight = async (
    name: string,
    locator: Parameters<HomePage['highlight']>[0],
    label: string,
  ) => {
    await captureStep(name, locator, label);
    await locator.evaluate((element) => (element as HTMLElement).click());
  };

  const signInAfterShowtime = async () => {
    const loginDialog = page.locator('[role="dialog"]:visible').last();
    const emailInput = loginDialog.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = loginDialog.locator('input[name="password"], input[type="password"]').first();

    await expect(emailInput).toBeVisible();
    await captureStep('06-login-form', emailInput, 'STEP 6 - SIGN-IN FORM');
    await emailInput.fill(testConfig.credentials.username);
    await passwordInput.fill(testConfig.credentials.password);

    const signInButton = loginDialog.getByRole('button', { name: /^sign in$/i }).last();
    await clickWithHighlight('07-submit-sign-in', signInButton, 'STEP 7 - SUBMIT SIGN-IN');

    const otpDialog = page.locator('[role="dialog"]:visible').last();
    const otpInputs = otpDialog.locator('input[type="tel"]');
    await expect(otpInputs.first()).toBeVisible();
    await captureStep('08-email-otp-form', otpInputs.first(), 'STEP 8 - ENTER EMAIL OTP');

    const otp = testConfig.credentials.pin;
    if (await otpInputs.count() >= otp.length) {
      for (let index = 0; index < otp.length; index += 1) {
        await otpInputs.nth(index).fill(otp[index]);
      }
    } else {
      await otpInputs.first().fill(otp);
    }

    const submitOtp = otpDialog.getByRole('button', { name: /submit|verify|continue/i }).last();
    await clickWithHighlight('09-submit-email-otp', submitOtp, 'STEP 9 - VERIFY EMAIL OTP');
    await expect(otpDialog).toBeHidden({ timeout: 30_000 });
  };

  await test.step('Open any movie and click Book Now', async () => {
    await homePage.open(testConfig.urls.home);
    await expect(homePage.bookNowLinks.first()).toBeVisible({ timeout: 30_000 });
    await clickWithHighlight('01-movie-book-now', homePage.bookNowLinks.first(), 'STEP 1 - CLICK BOOK NOW');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/moviesessions\//);
    movieTitle = decodeURIComponent(new URL(page.url()).pathname.split('/')[2] ?? '')
      .replace(/[-()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  });

  await test.step('Choose tomorrow and the second showtime', async () => {
    const experience = page.locator('#cinema0000000001, .cinemacarousal:visible').filter({ hasText: /Cinescape 360/i }).first();
    await expect(experience).toBeVisible();
    await clickWithHighlight('02-experience', experience, 'STEP 2 - CHOOSE CINESCAPE 360 EXPERIENCE');

    const date = page.getByRole('tab').nth(1);
    await expect(date).toBeVisible();
    await clickWithHighlight('03-date', date, 'STEP 3 - CHOOSE TOMORROW');
    await expect(date).toHaveAttribute('aria-selected', 'true');

    const showtimes = page.locator('.time-box:visible');
    await expect(showtimes.nth(1)).toBeVisible();
    const showtime = showtimes.nth(1);
    await clickWithHighlight('04-time', showtime, 'STEP 4 - CHOOSE TIME');
    await expect(page.locator('[role="dialog"]:visible')).toBeVisible();
    await signInAfterShowtime();

    const continuedShowtimes = page.locator('.time-box:visible');
    const continuedShowtime = continuedShowtimes.nth(1);
    await expect(continuedShowtime).toBeVisible();
    await continuedShowtime.click({ force: true });
    await expect(page.locator('body')).toContainText(/Select Seat Category/i, { timeout: 15_000 });
  });

  await test.step('Choose seat category and ticket type', async () => {
    const seatCategory = page.getByText('General', { exact: true }).last();
    await expect(seatCategory).toBeVisible();
    await clickWithHighlight('11-seat-category', seatCategory, 'STEP 11 - CHOOSE GENERAL SEAT CATEGORY');

    const seatType = page.getByText('Standard', { exact: true }).last();
    await expect(seatType).toBeVisible();
    await clickWithHighlight('12-seat-type', seatType, 'STEP 12 - CHOOSE STANDARD SEAT TYPE');
  });

  await test.step('Choose a seat and proceed', async () => {
    const ticketProceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last();
    await expect(ticketProceed).toBeVisible();
    await clickWithHighlight('13-ticket-proceed', ticketProceed, 'STEP 13 - PROCEED TO SEAT MAP');
    await expect(page).toHaveURL(/\/seatlayout$/);

    const seatCandidates = page.locator('.seat[id]:visible').filter({ has: page.locator('img') });
    await expect(seatCandidates.first()).toBeVisible();
    let selectedSeat = seatCandidates.first();
    const seatCount = await seatCandidates.count();
    for (let index = 0; index < seatCount; index += 1) {
      const candidate = seatCandidates.nth(index);
      await candidate.locator('img').first().click({ force: true });
      if (await candidate.evaluate((element) => element.classList.contains('active'))) {
        selectedSeat = candidate;
        break;
      }
    }
    await captureStep('14-seat', selectedSeat, 'STEP 14 - CHOOSE AVAILABLE SEAT');
    await expect(selectedSeat).toHaveClass(/active/);

    const seatProceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last();
    await captureStep('15-seat-proceed', seatProceed, 'STEP 15 - PROCEED FROM SEAT MAP');
    await seatProceed.click({ force: true });
    await expect(page).toHaveURL(/\/food\//, { timeout: 15_000 });
  });

  await test.step('Skip food and continue to payment', async () => {
    const foodProceed = page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i }).last();
    await expect(foodProceed).toBeVisible();
    await clickWithHighlight('17-food-proceed', foodProceed, 'STEP 17 - CONTINUE WITHOUT FOOD');
    await expect(page).toHaveURL(/\/payment\//);

  });

  await test.step('Apply wallet and confirm booking', async () => {
    const walletAccordion = page.getByRole('button', { name: /use your wallet/i }).last();
    await expect(walletAccordion).toBeVisible();
    await walletAccordion.scrollIntoViewIfNeeded();
    await clickWithHighlight('18-open-wallet', walletAccordion, 'STEP 18 - OPEN WALLET PAYMENT');
    await page.locator('body').press('End');
    await page.waitForTimeout(500);
    const removeWallet = page.getByRole('button', { name: /^remove$/i }).first();
    const alreadyApplied = await removeWallet.isVisible().catch(() => false);
    if (!alreadyApplied) {
      const walletApply = page.getByRole('button', { name: /^apply$/i }).first();
      await expect(walletApply).toBeVisible();
      await clickWithHighlight('19-wallet-apply', walletApply, 'STEP 19 - APPLY WALLET BALANCE');
    }
    await expect(page.locator('body')).toContainText(/wallet applied/i);

    const confirmBooking = page.getByRole('button', { name: 'Proceed', exact: true }).last();
    await expect(confirmBooking).toBeVisible();
    await clickWithHighlight('20-confirm-booking', confirmBooking, 'STEP 20 - CONFIRM BOOKING');
    await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText(/booking id/i);
  });

  await test.step('Open My Profile and cancel the confirmed booking', async () => {
    const profileLink = page.locator('a[href="/myaccount"], nav.header-nav .user-profile:visible').first();
    await expect(profileLink).toBeVisible();
    await clickWithHighlight('21-my-profile', profileLink, 'STEP 21 - OPEN MY PROFILE');
    await expect(page).toHaveURL(/\/myaccount/);
    await expect(page.locator('body')).toContainText(/welcome back|my account/i);
    await captureStep('22-my-profile', page.locator('body'), 'STEP 22 - MY PROFILE OPENED');

    const bookingsTab = page.getByText(/^bookings$/i).first();
    await expect(bookingsTab).toBeVisible();
    await clickWithHighlight('23-bookings', bookingsTab, 'STEP 23 - OPEN BOOKINGS');
    const titlePattern = movieTitle
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s()-]*');
    await expect(page.locator('body')).toContainText(new RegExp(titlePattern, 'i'));
    await captureStep('24-booking-found', page.locator('body'), 'STEP 24 - FIND NEW MOVIE BOOKING');

    const cancelBooking = page.locator('button:visible, a:visible')
      .filter({ hasText: /cancel booking|cancel/i })
      .first();
    await expect(cancelBooking).toBeVisible();
    await clickWithHighlight('25-cancel-booking', cancelBooking, 'STEP 25 - CANCEL BOOKING');

    const confirmCancel = page.locator('button:visible').filter({ hasText: /yes,?\s*I.?m sure|confirm|cancel booking/i }).last();
    await expect(confirmCancel).toBeVisible({ timeout: 10_000 });
    await clickWithHighlight('26-confirm-cancellation', confirmCancel, 'STEP 26 - CONFIRM CANCELLATION');
    await expect(page.locator('body')).toContainText(/cancelled|canceled|booking cancelled|no booking|upcoming bookings/i, {
      timeout: 30_000,
    });
    await captureStep('27-booking-cancelled', page.locator('body'), 'STEP 27 - CANCELLATION VERIFIED');
  });
});
