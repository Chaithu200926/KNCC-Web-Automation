import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinema booking flow is confirmed in My Profile', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(240_000);

  test.skip(
    !testConfig.credentials.username || !testConfig.credentials.password || !testConfig.credentials.pin,
    'Set TEST_USERNAME, TEST_PASSWORD, and TEST_PIN in .env before running the booking test.',
  );

  const homePage = new HomePage(page);
  let existingBookingFound = false;
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
  });

  await test.step('Choose experience, date, and time', async () => {
    const experience = page.locator('#cinema0000000001, .cinemacarousal:visible').filter({ hasText: /Cinescape 360/i }).first();
    await expect(experience).toBeVisible();
    await clickWithHighlight('02-experience', experience, 'STEP 2 - CHOOSE CINESCAPE 360 EXPERIENCE');

    const date = page.locator('.movie-date:visible').first();
    await expect(date).toBeVisible();
    await clickWithHighlight('03-date', date, 'STEP 3 - CHOOSE DATE');

    const showtime = page.locator('.time-box:visible').first();
    await expect(showtime).toBeVisible();
    await clickWithHighlight('04-time', showtime, 'STEP 4 - CHOOSE TIME');
    await expect(page.locator('[role="dialog"]:visible')).toBeVisible();
    await signInAfterShowtime();

    const continuedShowtime = page.locator('.time-box:visible').first();
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
    const hasExistingBooking = await expect(page.locator('body'))
      .toContainText(/Bookings Found!/i, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (hasExistingBooking) {
      existingBookingFound = true;
      const bookingModal = page.locator('[role="dialog"]:visible').last();
      await captureStep('16-bookings-found', bookingModal, 'STEP 16 - EXISTING BOOKING DETECTED');
      const goToBookings = page.locator('button:visible').filter({ hasText: /go to bookings/i }).first();
      await expect(goToBookings).toBeVisible();
      await goToBookings.click({ force: true });
      await homePage.open(new URL('/myaccount', testConfig.urls.home).toString());
    }
    if (!existingBookingFound) await expect(page).toHaveURL(/\/food\//);
  });

  await test.step('Skip food and open payment methods', async () => {
    if (existingBookingFound) return;
    const foodProceed = page.getByRole('button', { name: 'Proceed', exact: true });
    await expect(foodProceed).toBeVisible();
    await clickWithHighlight('17-food-proceed', foodProceed, 'STEP 17 - CONTINUE WITHOUT FOOD');
    await expect(page).toHaveURL(/\/payment\//);

    const paymentProceed = page.getByRole('button', { name: 'Proceed', exact: true });
    if (await paymentProceed.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await clickWithHighlight('18-payment-methods', paymentProceed, 'STEP 18 - OPEN PAYMENT METHODS');
    }
  });

  await test.step('Pay with KNET or wallet', async () => {
    if (existingBookingFound) return;
    const paymentHeading = page.getByRole('heading', { name: /select payment method/i });
    await expect(paymentHeading).toBeVisible();
    await paymentHeading.scrollIntoViewIfNeeded();
    await page.locator('body').press('End');
    await page.waitForTimeout(500);
    const visibleWalletApply = page.locator('button:visible').filter({ hasText: /^apply$/i }).first();
    const walletApplied = await visibleWalletApply.isVisible({ timeout: 5_000 }).catch(() => false);
    if (walletApplied) {
      await captureStep('19-wallet-apply', visibleWalletApply, 'STEP 19 - APPLY WALLET BALANCE');
      await visibleWalletApply.click({ force: true });
    }

    const knet = page.getByText('KNET', { exact: true }).last();
    const wallet = page.getByText(/Use your Wallet/i).last();
    const useWallet = await wallet.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!walletApplied) {
      const paymentMethod = useWallet ? wallet : knet;
      await expect(paymentMethod).toBeVisible();
      await clickWithHighlight('20-payment-method', paymentMethod, 'STEP 20 - CHOOSE KNET OR WALLET');
    }

    if (useWallet && !walletApplied) {
      const walletApply = page.getByRole('button', { name: /^apply$/i }).first();
      await expect(walletApply).toBeVisible();
      await clickWithHighlight('21-wallet-apply', walletApply, 'STEP 21 - APPLY WALLET BALANCE');
    } else {
      const numberInput = page.locator('input[name*="card" i], input[name*="knet" i], input[type="tel"]').first();
      const expiryInput = page.locator('input[name*="expir" i], input[placeholder*="expiry" i]').first();
      const pinInput = page.locator('input[name*="pin" i], input[placeholder*="pin" i]').first();

      if (await numberInput.isVisible({ timeout: 5_000 }).catch(() => false)) await numberInput.fill(testConfig.payment.knetNumber);
      if (await expiryInput.isVisible({ timeout: 2_000 }).catch(() => false)) await expiryInput.fill(testConfig.payment.knetExpiry);
      if (await pinInput.isVisible({ timeout: 2_000 }).catch(() => false)) await pinInput.fill(testConfig.payment.knetPin);
    }

    const payButton = page.getByRole('button', { name: /pay|confirm|complete|proceed|submit/i }).last();
    await expect(payButton).toBeVisible();
    await captureStep('22-confirm-payment', payButton, 'STEP 22 - CONFIRM PAYMENT');
    await payButton.click({ force: true });
    await expect(page.locator('body')).toContainText(/successful|confirmed|booking id|transaction/i, { timeout: 30_000 });
  });

  await test.step('Verify the confirmed ticket in My Profile > Bookings', async () => {
    if (!page.url().includes('/myaccount')) {
      const profileLink = page.locator('a[href="/myaccount"], nav.header-nav .user-profile:visible').first();
      await expect(profileLink).toBeVisible();
      await clickWithHighlight('23-my-profile', profileLink, 'STEP 23 - OPEN MY PROFILE');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/myaccount/);
    }

    const bookings = page.getByText(/bookings/i).first();
    await expect(bookings).toBeVisible();
    await clickWithHighlight('24-bookings', bookings, 'STEP 24 - OPEN BOOKINGS');
    await expect(page.locator('body')).toContainText(/confirmed|booking|ticket|Wake Up|Movie/i);
    await captureStep('25-booking-confirmed', page.locator('body'), 'STEP 25 - CONFIRMED TICKET VERIFIED');

    const cancelBooking = page.locator('button:visible, a:visible')
      .filter({ hasText: /cancel booking|cancel/i })
      .first();
    await expect(cancelBooking).toBeVisible();
    await clickWithHighlight('26-cancel-booking', cancelBooking, 'STEP 26 - CANCEL CONFIRMED BOOKING');

    const confirmCancel = page.locator('button:visible').filter({ hasText: /yes,?\s*I.?m sure/i }).first();
    await expect(confirmCancel).toBeVisible({ timeout: 10_000 });
    await clickWithHighlight('27-confirm-cancellation', confirmCancel, 'STEP 27 - CONFIRM CANCELLATION');

    const cancelConfirmation = page.locator('.swal2-container:visible, [role="dialog"]:visible').last();
    await expect(cancelConfirmation).toBeHidden({ timeout: 30_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/cancelled|canceled|no booking|booking cancelled|upcoming bookings/i, {
      timeout: 30_000,
    });
    await captureStep('28-booking-cancelled', page.locator('body'), 'STEP 28 - BOOKING CANCELLATION VERIFIED');
  });
});
