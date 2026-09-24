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
  let selectedShowDate = '';
  let selectedShowTime = '';
  let confirmedBookingId = '';
  const normalizeVisibleText = (text: string) => text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\u00A0/g, ' ');
  const readBookedDay = (text: string) => {
    const dateAndTimeText = normalizeVisibleText(text).match(/date\s*(?:&|and)\s*time[\s\S]{0,100}?\b(\d{1,2})\s+[A-Za-z]{3,9}\b/i)?.[1];
    return dateAndTimeText;
  };
  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await test.step(label, async () => {
      await homePage.highlight(locator, label);
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  };

  const clickWithHighlight = async (
    name: string,
    locator: Parameters<HomePage['highlight']>[0],
    label: string,
    useBrowserClick = false,
  ) => {
    await captureStep(name, locator, label);
    if (useBrowserClick) {
      await locator.click();
    } else {
      await locator.evaluate((element) => (element as HTMLElement).click());
    }
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
    await clickWithHighlight('03-date', date, 'STEP 3 - CHOOSE TOMORROW', true);
    await expect(date).toHaveAttribute('aria-selected', 'true');
    selectedShowDate = (await date.innerText()).replace(/\s+/g, ' ').trim();

    const showtimes = page.locator('.time-box:visible');
    await expect(showtimes.nth(1)).toBeVisible();
    const showtime = showtimes.nth(1);
    selectedShowTime = (await showtime.innerText()).replace(/\s+/g, ' ').trim();
    await clickWithHighlight('04-time', showtime, 'STEP 4 - CHOOSE TIME');
    await expect(page.locator('[role="dialog"]:visible')).toBeVisible();
    await signInAfterShowtime();

    const selectedDay = selectedShowDate.match(/\d{1,2}/)?.[0];
    if (!selectedDay) throw new Error(`Could not read the selected show date from "${selectedShowDate}".`);
    const dateAfterSignIn = page.getByRole('tab').filter({ hasText: selectedDay }).first();
    await expect(dateAfterSignIn).toBeVisible();
    await clickWithHighlight(
      '10-date-after-sign-in',
      dateAfterSignIn,
      'STEP 10 - RESELECT TOMORROW AFTER SIGN-IN',
      true,
    );
    await expect(dateAfterSignIn).toHaveAttribute('aria-selected', 'true');
    selectedShowDate = (await dateAfterSignIn.innerText()).replace(/\s+/g, ' ').trim();
    await captureStep(
      '10-date-selected-after-sign-in',
      dateAfterSignIn,
      'STEP 10A - VERIFY TOMORROW REMAINS SELECTED',
    );

    const continuedShowtime = page.locator('.time-box:visible').filter({ hasText: selectedShowTime }).first();
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
    await expect(seatProceed).toBeEnabled();
    await seatProceed.scrollIntoViewIfNeeded();
    await captureStep('15-seat-proceed', seatProceed, 'STEP 15 - PROCEED FROM SEAT MAP');
    await seatProceed.click();
    const bookingsFoundDialog = page.getByRole('dialog').filter({ hasText: /bookings found/i });
    if (await bookingsFoundDialog.isVisible().catch(() => false)) {
      const continueBooking = bookingsFoundDialog.getByRole('button', { name: /continue booking/i });
      await expect(continueBooking).toBeVisible();
      await clickWithHighlight(
        '15-existing-bookings-dialog',
        bookingsFoundDialog,
        'STEP 15A - EXISTING BOOKING NOTICE',
      );
      await clickWithHighlight(
        '15-continue-booking',
        continueBooking,
        'STEP 15B - CONTINUE NEW BOOKING',
      );
      await expect(bookingsFoundDialog).toBeHidden({ timeout: 10_000 });
      await seatProceed.click();
    }
    await expect(page).toHaveURL(/\/(?:food|payment)\//, { timeout: 30_000 });
  });

  await test.step('Skip food and continue to payment', async () => {
    if (/\/payment\//.test(page.url())) {
      await expect(page.getByRole('heading', { name: /select payment method/i })).toBeVisible();
      await captureStep('17-food-skipped', page.locator('body'), 'STEP 17 - FOOD STEP ALREADY SKIPPED');
      return;
    }
    const foodProceed = page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i }).last();
    await expect(foodProceed).toBeVisible();
    await expect(foodProceed).toBeEnabled();
    await clickWithHighlight('17-food-proceed', foodProceed, 'STEP 17 - CONTINUE WITHOUT FOOD');
    await expect(page).toHaveURL(/\/payment\//, { timeout: 15_000 });
  });

  await test.step('Apply wallet and confirm booking', async () => {
    await expect(page.getByRole('heading', { name: /select payment method/i })).toBeVisible({ timeout: 15_000 });
    const selectedDay = selectedShowDate.match(/\d{1,2}/)?.[0];
    if (!selectedDay) throw new Error(`Could not read the selected show date from "${selectedShowDate}".`);
    const paymentSummary = await page.locator('body').innerText();
    const paymentDay = readBookedDay(paymentSummary);
    expect(paymentDay, 'Payment summary should show the date selected for this booking').toBe(selectedDay);

    const walletAccordion = page.getByRole('button', { name: /use your wallet/i }).last();
    const walletApply = page.getByRole('button', { name: /^apply$/i }).first();
    const walletRemove = page.getByRole('button', { name: /^remove$/i }).first();
    await expect(walletAccordion).toBeVisible();
    await walletAccordion.scrollIntoViewIfNeeded();

    let walletAlreadyApplied = await walletRemove.isVisible().catch(() => false);
    const walletOptionsOpen = await walletApply.isVisible().catch(() => false) || walletAlreadyApplied;
    if (!walletOptionsOpen) {
      await clickWithHighlight('18-open-wallet', walletAccordion, 'STEP 18 - OPEN WALLET PAYMENT');
      await expect.poll(async () =>
        (await walletApply.isVisible().catch(() => false)) ||
        (await walletRemove.isVisible().catch(() => false)),
      { timeout: 10_000 }).toBe(true);
      walletAlreadyApplied = await walletRemove.isVisible().catch(() => false);
    }

    if (!walletAlreadyApplied) {
      await expect(walletApply).toBeVisible();
      await walletApply.scrollIntoViewIfNeeded();
      await captureStep('19-wallet-apply', walletApply, 'STEP 19 - APPLY WALLET BALANCE');
      await walletApply.click();
      await expect(walletRemove).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.locator('body')).toContainText(/wallet applied/i);

    const confirmBooking = page.getByRole('button', { name: 'Proceed', exact: true }).last();
    await expect(confirmBooking).toBeVisible();
    await expect(confirmBooking).toBeEnabled();
    await confirmBooking.scrollIntoViewIfNeeded();
    await captureStep('20-confirm-booking', confirmBooking, 'STEP 20 - CONFIRM BOOKING');
    await confirmBooking.click();
    await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText(/booking id/i);
    const confirmationText = await page.locator('body').innerText();
    const normalizedConfirmationText = normalizeVisibleText(confirmationText);
    const bookedDay = readBookedDay(normalizedConfirmationText);
    confirmedBookingId = normalizedConfirmationText.match(/booking\s*id\s*[:#]?\s*([A-Z0-9]{4,})/i)?.[1] ?? '';
    expect(bookedDay, `Booking date should match the selected show date "${selectedShowDate}"`).toBe(selectedDay);
    expect(confirmedBookingId, 'The confirmation page should show a booking ID').not.toBe('');
    if (!bookedDay) {
      await testInfo.attach('booking-confirmation-visible-text', {
        body: normalizedConfirmationText,
        contentType: 'text/plain',
      });
    }
    await captureStep(
      '20-booking-date-confirmed',
      page.locator('body'),
      'STEP 20A - VERIFY BOOKING DATE',
    );
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
    await page.goto(new URL('/myaccount', testConfig.urls.home).toString(), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/myaccount/);
    const bookingsAfterCancellation = page.getByText(/^bookings$/i).first();
    await expect(bookingsAfterCancellation).toBeVisible();
    await bookingsAfterCancellation.click();
    await expect(page.locator('body')).toContainText(/upcoming bookings|no bookings|no upcoming/i, { timeout: 15_000 });
    if (confirmedBookingId) {
      await expect(page.locator('body')).not.toContainText(confirmedBookingId);
    } else {
      await expect(page.locator('body')).not.toContainText(new RegExp(titlePattern, 'i'));
    }
    await captureStep(
      '27-booking-cancelled',
      page.locator('body'),
      'STEP 27 - CANCELLATION COMPLETE - NO ACTIVE BOOKING',
    );
  });
});
