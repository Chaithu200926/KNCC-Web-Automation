// WEB-03 Cinema booking with wallet, confirmed and cancelled in My Profile - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Books one seat for tomorrow's show, pays with the test account's wallet, checks the confirmation page,
// then cancels the booking in My Profile so no booking is left on the test account (the wallet is refunded).
import type { Locator } from '@playwright/test'; // Type for element locators (used in helper signatures).
import { test, expect } from './fixtures'; // Shared test setup: gives each test the `testConfig` settings.
import { HomePage } from '../pages/HomePage'; // Page object for the homepage (Book Now links, highlight helper).

// Slow every browser action down by 300 ms so the recorded video is easy to follow.
test.use({ launchOptions: { slowMo: 300 } });

test('WEB-03 Cinema booking with wallet, confirmed and cancelled in My Profile', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(240_000); // The whole flow (sign-in, seat, payment, cancellation) needs more than the default 60 s.

  // Skip (instead of fail) when the test account details are missing from .env / secrets.
  test.skip(
    !testConfig.credentials.username || !testConfig.credentials.password || !testConfig.credentials.pin,
    'Set TEST_USERNAME, TEST_PASSWORD, and TEST_PIN in .env before running the booking test.',
  );

  const homePage = new HomePage(page); // Helper object for the homepage.
  let movieTitle = ''; // Title of the movie booked (read from the URL), used to find the booking later.
  let selectedShowDate = ''; // Text of the date tab chosen (tomorrow), used to verify the booking date.
  let selectedShowTime = ''; // Text of the showtime chosen, used to click the same showtime after sign-in.
  let confirmedBookingId = ''; // Booking ID shown on the confirmation page, used to check the cancellation.

  // Clean text read from the page: unify characters and remove invisible direction/space marks.
  const normalizeVisibleText = (text: string) => text
    .normalize('NFKC') // Turn look-alike characters into standard ones.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '') // Remove zero-width and text-direction marks.
    .replace(/\u00A0/g, ' '); // Turn non-breaking spaces into normal spaces.
  // Read the day number from the "Date & Time" part of the payment summary (e.g. "29 Sep" → "29").
  const readBookedDay = (text: string) => {
    const dateAndTimeText = normalizeVisibleText(text).match(/date\s*(?:&|and)\s*time[\s\S]{0,100}?\b(\d{1,2})\s+[A-Za-z]{3,9}\b/i)?.[1];
    return dateAndTimeText; // The day number, or undefined if not found.
  };
  // Record one reported step: highlight the element, then attach a full-page screenshot to the report.
  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await test.step(label, async () => { // Show this as a named step in the report.
      await homePage.highlight(locator, label); // Draw a yellow box around the element and a red step label.
      await testInfo.attach(name, { // Attach the screenshot under this name (the dashboard maps it to the step).
        body: await page.screenshot({ fullPage: true }), // Take a screenshot of the whole page.
        contentType: 'image/png',
      });
    });
  };

  // Highlight + screenshot an element, then click it.
  const clickWithHighlight = async (
    name: string, // Screenshot name.
    locator: Parameters<HomePage['highlight']>[0], // Element to click.
    label: string, // Step label shown in the report.
    useBrowserClick = false, // true = real mouse click; false = JavaScript click (works even if covered).
  ) => {
    await captureStep(name, locator, label); // Record the step before clicking.
    if (useBrowserClick) {
      await locator.click(); // Real mouse click.
    } else {
      await locator.evaluate((element) => (element as HTMLElement).click()); // Click through JavaScript.
    }
  };

  // Make an input's text invisible in screenshots and the video (for credentials and card details).
  const hideInputValueInVideo = async (input: Locator) => {
    await input.evaluate((element) => {
      const field = element as HTMLInputElement;
      field.style.setProperty('color', 'transparent', 'important'); // Hide the typed characters.
      field.style.setProperty('text-shadow', 'none', 'important'); // Remove any shadow that could reveal them.
      field.style.setProperty('caret-color', 'transparent', 'important'); // Hide the blinking cursor too.
    });
  };

  // Sign in when the site asks for it after choosing a showtime: email + password, then the email OTP.
  const signInAfterShowtime = async () => {
    const loginDialog = page.locator('[role="dialog"]:visible').last(); // The sign-in pop-up.
    const emailInput = loginDialog.locator('input[name="email"], input[type="email"]').first(); // Email field.
    const passwordInput = loginDialog.locator('input[name="password"], input[type="password"]').first(); // Password field.

    await expect(emailInput).toBeVisible(); // Wait for the sign-in form.
    await captureStep('06-login-form', emailInput, 'STEP 6 - SIGN-IN FORM'); // Screenshot the empty form.
    await hideInputValueInVideo(emailInput); // Hide the email in screenshots/video.
    await emailInput.fill(testConfig.credentials.username); // Type the test account email.
    await passwordInput.fill(testConfig.credentials.password); // Type the password (password fields are masked).

    const signInButton = loginDialog.getByRole('button', { name: /^sign in$/i }).last(); // "Sign in" button.
    await clickWithHighlight('07-submit-sign-in', signInButton, 'STEP 7 - SUBMIT SIGN-IN'); // Submit the form.

    const otpDialog = page.locator('[role="dialog"]:visible').last(); // The OTP pop-up that follows.
    const otpInputs = otpDialog.locator('input[type="tel"]'); // One box per OTP digit.
    await expect(otpInputs.first()).toBeVisible(); // Wait for the OTP boxes.
    await captureStep('08-email-otp-form', otpInputs.first(), 'STEP 8 - ENTER EMAIL OTP'); // Screenshot them.
    for (let index = 0; index < await otpInputs.count(); index += 1) {
      await hideInputValueInVideo(otpInputs.nth(index)); // Hide every OTP box's value.
    }

    const otp = testConfig.credentials.pin; // The OTP code for the test account.
    if (await otpInputs.count() >= otp.length) { // One box per digit:
      for (let index = 0; index < otp.length; index += 1) {
        await otpInputs.nth(index).fill(otp[index]); // type each digit into its own box.
      }
    } else {
      await otpInputs.first().fill(otp); // Single box: type the whole code.
    }

    const submitOtp = otpDialog.getByRole('button', { name: /submit|verify|continue/i }).last(); // OTP submit button.
    await clickWithHighlight('09-submit-email-otp', submitOtp, 'STEP 9 - VERIFY EMAIL OTP'); // Submit the OTP.
    await expect(otpDialog).toBeHidden({ timeout: 30_000 }); // The pop-up closes after a correct OTP.
    const signedInProfileLink = page.locator('a[href="/myaccount"], nav.header-nav .user-profile:visible').first(); // Profile link shown when signed in.
    await expect(signedInProfileLink).toBeVisible({ timeout: 30_000 }); // The header now shows the signed-in profile.
  };

  await test.step('Open any movie and click Book Now', async () => {
    await homePage.open(testConfig.urls.home); // Load the Cinescape homepage.
    await expect(homePage.bookNowLinks.first()).toBeVisible({ timeout: 30_000 }); // Wait for the movie list.
    await clickWithHighlight('01-movie-book-now', homePage.bookNowLinks.first(), 'STEP 1 - CLICK BOOK NOW'); // Open the first movie.
    await page.waitForLoadState('domcontentloaded'); // Wait for the movie sessions page.
    await expect(page).toHaveURL(/\/moviesessions\//); // Confirm we are on the sessions page.
    movieTitle = decodeURIComponent(new URL(page.url()).pathname.split('/')[2] ?? '') // Movie name part of the URL,
      .replace(/[-()]+/g, ' ') // with dashes and brackets turned into spaces,
      .replace(/\s+/g, ' ') // repeated spaces collapsed,
      .trim(); // and outer spaces removed.
  });

  await test.step('Choose tomorrow and a showtime on that calendar day', async () => {
    // The "Cinescape 360" cinema block on the sessions page.
    const experience = page.locator('#cinema0000000001, .cinemacarousal:visible').filter({ hasText: /Cinescape 360/i }).first(); // Cinescape 360 block.
    await expect(experience).toBeVisible(); // Wait for it.
    await clickWithHighlight('02-experience', experience, 'STEP 2 - CHOOSE CINESCAPE 360 EXPERIENCE'); // Select it.

    const date = page.getByRole('tab').nth(1); // Second date tab = tomorrow.
    await expect(date).toBeVisible({ timeout: 30_000 }); // UAT can take a while to load the date tabs.
    await clickWithHighlight('03-date', date, 'STEP 3 - CHOOSE TOMORROW', true); // Select tomorrow (real click).
    await expect(date).toHaveAttribute('aria-selected', 'true'); // Confirm tomorrow is selected.
    selectedShowDate = (await date.innerText()).replace(/\s+/g, ' ').trim(); // Remember the date text.

    const showtimes = page.locator('.time-box:visible'); // All showtime buttons for that day.
    await expect(showtimes.first()).toBeVisible(); // Wait for them.
    const showtimeCount = await showtimes.count(); // How many there are.
    const preferredIndexes = [1, 2]; // Prefer the 2nd or 3rd showtime (the 1st is often too soon / after midnight).
    let showtime = showtimes.first(); // Fallback: the first showtime.
    let selectedClockHour = -1; // Hour of the chosen showtime (-1 = not chosen yet).
    for (const index of preferredIndexes) {
      if (index >= showtimeCount) continue; // Skip positions that do not exist.
      const candidate = showtimes.nth(index); // The showtime at this position.
      const timeText = (await candidate.innerText()).replace(/\s+/g, ' ').trim(); // Its text, e.g. "18:30".
      const hour = Number(timeText.match(/\b(\d{1,2}):\d{2}\b/)?.[1]); // Its hour as a number.
      if (Number.isFinite(hour) && hour >= 6 && hour < 24) { // A daytime/evening show on the same calendar day:
        showtime = candidate; // use it,
        selectedClockHour = hour; // remember its hour,
        break; // and stop looking.
      }
    }
    if (selectedClockHour < 0) { // No preferred showtime matched:
      const firstShowtimeText = (await showtime.innerText()).replace(/\s+/g, ' ').trim(); // read the first one,
      selectedClockHour = Number(firstShowtimeText.match(/\b(\d{1,2}):\d{2}\b/)?.[1]); // and take its hour.
    }
    if (!Number.isFinite(selectedClockHour) || selectedClockHour < 6) { // Only after-midnight shows are left:
      throw new Error('No showtime on the selected calendar day is available; the listed times are after midnight.'); // Stop: no suitable show.
    }
    selectedShowTime = (await showtime.innerText()).replace(/\s+/g, ' ').trim(); // Remember the showtime text.
    await clickWithHighlight('04-time', showtime, 'STEP 4 - CHOOSE TIME'); // Click the showtime.
    await expect(page.locator('[role="dialog"]:visible')).toBeVisible(); // The sign-in pop-up appears.
    await signInAfterShowtime(); // Sign in with email, password and OTP.

    const selectedDay = selectedShowDate.match(/\d{1,2}/)?.[0]; // Day number of the chosen date.
    if (!selectedDay) throw new Error(`Could not read the selected show date from "${selectedShowDate}".`); // Stop with a clear message if it cannot be read.
    const dateAfterSignIn = page.getByRole('tab').filter({ hasText: selectedDay }).first(); // Same date tab after sign-in.
    await expect(dateAfterSignIn).toBeVisible(); // Wait for it.
    await clickWithHighlight(
      '10-date-after-sign-in',
      dateAfterSignIn,
      'STEP 10 - RESELECT TOMORROW AFTER SIGN-IN',
      true, // Real click.
    );
    await expect(dateAfterSignIn).toHaveAttribute('aria-selected', 'true'); // Confirm it is selected.
    selectedShowDate = (await dateAfterSignIn.innerText()).replace(/\s+/g, ' ').trim(); // Refresh the remembered date text.
    await captureStep(
      '10-date-selected-after-sign-in',
      dateAfterSignIn,
      'STEP 10A - VERIFY TOMORROW REMAINS SELECTED',
    );

    const continuedShowtime = page.locator('.time-box:visible').filter({ hasText: selectedShowTime }).first(); // Same showtime.
    await expect(continuedShowtime).toBeVisible(); // Wait for it.
    await continuedShowtime.click({ force: true }); // Click it again to continue.
    await expect(page.locator('body')).toContainText(/Select Seat Category/i, { timeout: 15_000 }); // Seat category screen opens.
  });

  await test.step('Choose seat category and ticket type', async () => {
    const seatCategory = page.getByText('General', { exact: true }).last(); // "General" seat category.
    await expect(seatCategory).toBeVisible(); // Wait for it.
    await clickWithHighlight('11-seat-category', seatCategory, 'STEP 11 - CHOOSE GENERAL SEAT CATEGORY'); // Select it.

    const seatType = page.getByText('Standard', { exact: true }).last(); // "Standard" ticket type.
    await expect(seatType).toBeVisible(); // Wait for it.
    await clickWithHighlight('12-seat-type', seatType, 'STEP 12 - CHOOSE STANDARD SEAT TYPE'); // Select it.
  });

  await test.step('Choose a seat and proceed', async () => {
    const ticketProceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last(); // "PROCEED" to the seat map.
    await expect(ticketProceed).toBeVisible(); // Wait for it.
    await clickWithHighlight('13-ticket-proceed', ticketProceed, 'STEP 13 - PROCEED TO SEAT MAP'); // Click it.
    await expect(page).toHaveURL(/\/seatlayout$/); // The seat map page opens.

    const seatCandidates = page.locator('.seat[id]:visible').filter({ has: page.locator('img') }); // Seats with an icon.
    await expect(seatCandidates.first()).toBeVisible(); // Wait for the seat map.
    let selectedSeat = seatCandidates.first(); // Fallback: the first seat.
    const seatCount = await seatCandidates.count(); // Number of seats.
    for (let index = 0; index < seatCount; index += 1) {
      const candidate = seatCandidates.nth(index); // Try each seat in turn.
      await candidate.locator('img').first().click({ force: true }); // Click the seat icon.
      if (await candidate.evaluate((element) => element.classList.contains('active'))) { // Seat became selected:
        selectedSeat = candidate; // keep it,
        break; // and stop looking.
      }
    }
    await captureStep('14-seat', selectedSeat, 'STEP 14 - CHOOSE AVAILABLE SEAT'); // Screenshot the chosen seat.
    await expect(selectedSeat).toHaveClass(/active/); // Confirm a seat is selected.

    const seatProceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last(); // "PROCEED" from the seat map.
    await expect(seatProceed).toBeEnabled(); // It is enabled once a seat is chosen.
    await seatProceed.scrollIntoViewIfNeeded(); // Scroll to it.
    await captureStep('15-seat-proceed', seatProceed, 'STEP 15 - PROCEED FROM SEAT MAP'); // Screenshot it.
    await seatProceed.click(); // Click it.
    await expect(page).toHaveURL(/\/(?:food|payment)\//, { timeout: 30_000 }); // Food page or straight to payment.
  });

  await test.step('Skip food and continue to payment', async () => {
    if (/\/payment\//.test(page.url())) { // Some sessions skip the food page:
      await expect(page.getByRole('heading', { name: /select payment method/i })).toBeVisible(); // already on payment,
      await captureStep('17-food-skipped', page.locator('body'), 'STEP 17 - FOOD STEP ALREADY SKIPPED'); // record it,
      return; // and move on.
    }
    const foodProceed = page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i }).last(); // "Skip & Proceed".
    await expect(foodProceed).toBeVisible(); // Wait for it.
    await expect(foodProceed).toBeEnabled(); // Make sure it can be clicked.
    await clickWithHighlight('17-food-proceed', foodProceed, 'STEP 17 - CONTINUE WITHOUT FOOD'); // Skip food.
    await expect(page).toHaveURL(/\/payment\//, { timeout: 15_000 }); // The payment page opens.
  });

  await test.step('Apply wallet and confirm booking', async () => {
    await expect(page.getByRole('heading', { name: /select payment method/i })).toBeVisible({ timeout: 15_000 }); // Payment page is ready.
    const selectedDay = selectedShowDate.match(/\d{1,2}/)?.[0]; // Day number of the chosen date.
    if (!selectedDay) throw new Error(`Could not read the selected show date from "${selectedShowDate}".`); // Stop with a clear message if it cannot be read.
    const paymentSummary = await page.locator('body').innerText(); // All text on the payment page.
    const paymentDay = readBookedDay(paymentSummary); // Day shown under "Date & Time".
    expect(paymentDay, 'Payment summary should show the date selected for this booking').toBe(selectedDay); // Same day as chosen.

    const walletAccordion = page.getByRole('button', { name: /use your wallet/i }).last(); // "Use your wallet" section header.
    const walletApply = page.getByRole('button', { name: /^apply$/i }).first(); // Its Apply button.
    const walletRemove = page.getByRole('button', { name: /^remove$/i }).first(); // Shown instead of Apply once the wallet is applied.
    await expect(walletAccordion).toBeVisible(); // Wait for the wallet section.
    await walletAccordion.scrollIntoViewIfNeeded(); // Scroll to it.

    let walletAlreadyApplied = await walletRemove.isVisible().catch(() => false); // Wallet already applied (e.g. from an earlier attempt)?
    const walletOptionsOpen = await walletApply.isVisible().catch(() => false) || walletAlreadyApplied; // Is the section already open?
    if (!walletOptionsOpen) { // Closed:
      await clickWithHighlight('18-open-wallet', walletAccordion, 'STEP 18 - OPEN WALLET PAYMENT'); // open it,
      await expect.poll(async () => // then wait (up to 10 s) until Apply or Remove shows,
        (await walletApply.isVisible().catch(() => false)) ||
        (await walletRemove.isVisible().catch(() => false)),
      { timeout: 10_000 }).toBe(true);
      walletAlreadyApplied = await walletRemove.isVisible().catch(() => false); // and check again whether it is already applied.
    }

    if (!walletAlreadyApplied) { // Not applied yet:
      await expect(walletApply).toBeVisible(); // wait for Apply,
      await walletApply.scrollIntoViewIfNeeded(); // scroll to it,
      await captureStep('19-wallet-apply', walletApply, 'STEP 19 - APPLY WALLET BALANCE'); // screenshot it,
      await walletApply.click(); // click it,
      await expect(walletRemove).toBeVisible({ timeout: 15_000 }); // and wait until it turns into Remove.
    }
    await expect(page.locator('body')).toContainText(/wallet applied/i); // The page confirms "Wallet applied".

    const confirmBooking = page.getByRole('button', { name: 'Proceed', exact: true }).last(); // "Proceed" = pay and confirm.
    await expect(confirmBooking).toBeVisible(); // Wait for it.
    await expect(confirmBooking).toBeEnabled(); // It is enabled once the wallet covers the total.
    await confirmBooking.scrollIntoViewIfNeeded(); // Scroll to it.
    await captureStep('20-confirm-booking', confirmBooking, 'STEP 20 - CONFIRM BOOKING'); // Screenshot it.
    await confirmBooking.click(); // Pay with the wallet.
    await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 30_000 }); // Booking confirmation page (success).
    await expect(page.locator('body')).toContainText(/booking id/i); // The confirmation page shows a booking ID label.
    const confirmationText = await page.locator('body').innerText(); // All text on the confirmation page.
    const normalizedConfirmationText = normalizeVisibleText(confirmationText); // Cleaned-up version of that text.
    const confirmedDateTime = page.getByRole('heading', { // The booked date and time heading:
      name: /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s*\|\s*\d{1,2}:\d{2}$/, // Heading like "29 September 2026 | 18:30".
    }).first();
    await expect(confirmedDateTime).toBeVisible(); // Wait for the date/time heading.
    const confirmedDateTimeText = normalizeVisibleText(await confirmedDateTime.innerText()); // Its text.
    const bookedDay = confirmedDateTimeText.match(/^(\d{1,2})\b/)?.[1]; // Day number of the booking.
    const bookingIdLabel = page.getByText('Booking ID', { exact: true }).first(); // "Booking ID" label.
    const bookingIdValue = bookingIdLabel.locator('..').getByRole('heading').first(); // The ID shown next to it.
    await expect(bookingIdValue).toBeVisible(); // Wait for the ID.
    confirmedBookingId = normalizeVisibleText(await bookingIdValue.innerText()); // Remember the booking ID.
    expect(bookedDay, `Booking date should match the selected show date "${selectedShowDate}"`).toBe(selectedDay); // Right day?
    expect(confirmedBookingId, 'The confirmation page should show a booking ID').not.toBe(''); // ID present?
    if (!bookedDay) { // If the day could not be read, attach the page text to help debugging.
      await testInfo.attach('booking-confirmation-visible-text', {
        body: `${confirmedDateTimeText}\n\n${normalizedConfirmationText}`,
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
    const profileLink = page.locator('a[href="/myaccount"], nav.header-nav .user-profile:visible').first(); // Profile link in the header.
    await expect(profileLink).toBeVisible(); // Wait for it.
    await clickWithHighlight('21-my-profile', profileLink, 'STEP 21 - OPEN MY PROFILE'); // Open My Profile.
    await expect(page).toHaveURL(/\/myaccount/); // Account page opens.
    await expect(page.locator('body')).toContainText(/welcome back|my account/i); // Account page content is shown.
    await captureStep('22-my-profile', page.locator('body'), 'STEP 22 - MY PROFILE OPENED'); // Screenshot it.

    const bookingsTab = page.getByText(/^bookings$/i).first(); // "Bookings" tab.
    await expect(bookingsTab).toBeVisible(); // Wait for it.
    await clickWithHighlight('23-bookings', bookingsTab, 'STEP 23 - OPEN BOOKINGS'); // Open it.
    const titlePattern = movieTitle // Build a flexible pattern from the movie title:
      .split(/\s+/) // split it into words,
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape special characters,
      .join('[\\s()-]*'); // and allow spaces, dashes or brackets between words.
    await expect(page.locator('body')).toContainText(new RegExp(titlePattern, 'i')); // The new booking is listed.
    await captureStep('24-booking-found', page.locator('body'), 'STEP 24 - FIND NEW MOVIE BOOKING'); // Screenshot it.

    const cancelBooking = page.locator('button:visible, a:visible') // Visible buttons and links:
      .filter({ hasText: /cancel booking|cancel/i }) // "Cancel booking" button/link,
      .first(); // on the first (newest) booking.
    await expect(cancelBooking).toBeVisible(); // Wait for it.
    await clickWithHighlight('25-cancel-booking', cancelBooking, 'STEP 25 - CANCEL BOOKING'); // Click it.

    const confirmCancel = page.locator('button:visible').filter({ hasText: /yes,?\s*I.?m sure|confirm|cancel booking/i }).last(); // "Yes, I'm sure".
    await expect(confirmCancel).toBeVisible({ timeout: 10_000 }); // Wait for the confirmation pop-up.
    const cancellationResponsePromise = page.waitForResponse((response) => { // Start listening for the cancel API call.
      const requestUrl = new URL(response.url()); // URL of each response.
      return requestUrl.pathname === '/api/content/trans/cancelbooking' // The cancel-booking endpoint,
        && response.request().method() === 'POST'; // called with POST.
    }, { timeout: 30_000 });
    await clickWithHighlight('26-confirm-cancellation', confirmCancel, 'STEP 26 - CONFIRM CANCELLATION'); // Confirm.
    const cancellationResponse = await cancellationResponsePromise; // Wait for the cancel API answer.
    expect(cancellationResponse.ok(), 'The booking cancellation request should succeed').toBeTruthy(); // It must succeed.
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 }); // Site returns to the homepage.
    const profileAfterCancellation = page.locator('a[href="/myaccount"]').first(); // Profile link again.
    await expect(profileAfterCancellation).toBeVisible(); // Wait for it.
    await profileAfterCancellation.click(); // Open My Profile.
    await expect(page).toHaveURL(/\/myaccount/); // Account page opens.
    const bookingsAfterCancellation = page.getByText(/^bookings$/i).first(); // "Bookings" tab.
    await expect(bookingsAfterCancellation).toBeVisible(); // Wait for it.
    await bookingsAfterCancellation.click(); // Open it.
    await expect(page.locator('body')).toContainText(/upcoming bookings|no bookings|no upcoming/i, { timeout: 15_000 }); // List loaded.
    if (confirmedBookingId) {
      await expect(page.locator('body')).not.toContainText(confirmedBookingId); // The cancelled booking ID is gone.
    } else {
      await expect(page.locator('body')).not.toContainText(new RegExp(titlePattern, 'i')); // Or: the movie is no longer listed.
    }
    await captureStep(
      '27-booking-cancelled',
      page.locator('body'),
      'STEP 27 - CANCELLATION COMPLETE - NO ACTIVE BOOKING',
    );
  });
});
