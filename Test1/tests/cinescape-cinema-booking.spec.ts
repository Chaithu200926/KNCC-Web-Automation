import { test, expect } from './fixtures';
import { HomePage } from '../pages/HomePage';

test('Cinema booking flow reaches seat selection', async ({ page, testConfig }, testInfo) => {
  test.setTimeout(180_000);

  test.skip(
    !testConfig.credentials.username || !testConfig.credentials.password || !testConfig.credentials.pin ||
      !testConfig.payment.cardNumber || !testConfig.payment.cardExpiry || !testConfig.payment.cardCvv,
    'Set the test credentials and card payment values in .env before running the booking test.',
  );

  const homePage = new HomePage(page);
  const captureStep = async (name: string, locator: Parameters<HomePage['highlight']>[0], label: string) => {
    await homePage.highlight(locator, label);
    await testInfo.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  };

  await test.step('Open the Cinescape homepage', async () => {
    await homePage.open(testConfig.urls.home);
    await expect(homePage.logo).toBeVisible();
    await captureStep('01-homepage-loaded', homePage.logo, 'STEP 1 - HOMEPAGE LOADED');
  });

  await test.step('Sign in and verify the account PIN', async () => {
    await captureStep('02-profile-before-click', homePage.profileControl, 'STEP 2 - CLICK MY PROFILE');
    await homePage.profileControl.click();
    await expect(homePage.profileDialog).toBeVisible();

    const loginDialog = page.locator('[role="dialog"]:visible').last();
    const emailInput = loginDialog.locator(
      'input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[type="tel"]',
    ).first();
    const passwordInput = loginDialog.locator(
      'input[type="password"], input[name*="password" i], input[placeholder*="password" i]',
    ).first();

    await captureStep('03-login-fields', emailInput, 'STEP 3 - LOGIN FORM READY');
    await emailInput.fill(testConfig.credentials.username);
    await passwordInput.fill(testConfig.credentials.password);
    const signInButton = loginDialog.getByRole('button', { name: /sign in|login|submit/i }).last();
    await captureStep('04-submit-login-before-click', signInButton, 'STEP 4 - SUBMIT LOGIN');
    await signInButton.click();

    const pinDialog = page.locator('[role="dialog"]:visible').last();
    const pinInput = pinDialog.locator(
      'input[name*="pin" i], input[placeholder*="pin" i], input[autocomplete="one-time-code"], input:visible',
    ).last();
    if (await pinInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await captureStep('05-pin-verification', pinInput, 'STEP 5 - ENTER EMAIL OR MOBILE PIN');
      await pinInput.fill(testConfig.credentials.pin);
      const verifyButton = pinDialog.getByRole('button', { name: /verify|continue|submit|confirm/i }).last();
      await captureStep('06-pin-submit-before-click', verifyButton, 'STEP 6 - VERIFY PIN');
      await verifyButton.click();
    }

    await expect(homePage.profileDialog).toBeHidden({ timeout: 30_000 });
  });

  await test.step('Open the first available movie session', async () => {
    await homePage.open(testConfig.urls.home);
    await captureStep('07-first-movie-session', homePage.bookNowLinks.first(), 'STEP 7 - CLICK BOOK NOW');
    await homePage.openFirstMovieSession();
    await expect(page).toHaveTitle(/Cinescape/i);
    await expect(page.locator('body')).toContainText(/date|showtime|session|book now/i);
  });

  await test.step('Select a showtime and verify booking stage', async () => {
    const showtime = page.locator('button:visible, a:visible')
      .filter({ hasText: /\b(?:am|pm)\b|\d{1,2}:\d{2}/i })
      .first();
    await expect(showtime).toBeVisible();
    await captureStep('08-showtime-before-click', showtime, 'STEP 8 - SELECT SHOWTIME');
    await showtime.click();
    await expect(page.locator('body')).toContainText(/seat|select.*ticket|booking summary|confirm/i);
  });

  await test.step('Complete the dummy card payment', async () => {
    const cardMethod = page.getByText(/credit card|visa|mastercard/i).first();
    if (await cardMethod.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await captureStep('09-card-method-before-click', cardMethod, 'STEP 9 - SELECT CREDIT CARD');
      await cardMethod.click();
    }

    const cardNumber = page.locator(
      'input[autocomplete="cc-number"], input[name*="card" i], input[placeholder*="card number" i]',
    ).first();
    const cardExpiry = page.locator(
      'input[autocomplete="cc-exp"], input[name*="expir" i], input[placeholder*="mm/yy" i]',
    ).first();
    const cardCvv = page.locator(
      'input[autocomplete="cc-csc"], input[name*="cvv" i], input[name*="cvc" i], input[placeholder*="cvv" i]',
    ).first();

    await expect(cardNumber).toBeVisible();
    await expect(cardExpiry).toBeVisible();
    await expect(cardCvv).toBeVisible();
    await captureStep('10-payment-form-ready', cardNumber, 'STEP 10 - PAYMENT FORM READY');
    await cardNumber.fill(testConfig.payment.cardNumber);
    await cardExpiry.fill(testConfig.payment.cardExpiry);
    await cardCvv.fill(testConfig.payment.cardCvv);

    const payButton = page.getByRole('button', { name: /pay|make payment|complete booking|confirm/i }).last();
    await expect(payButton).toBeVisible();
    await captureStep('11-pay-before-click', payButton, 'STEP 11 - COMPLETE PAYMENT');
    await payButton.click();
    await expect(page.locator('body')).toContainText(/payment successful|booking confirmed|confirmation|booking id|transaction/i, {
      timeout: 30_000,
    });
    await captureStep('12-booking-confirmed', page.locator('body'), 'STEP 12 - BOOKING CONFIRMED');
  });
});