// WEB-35 OTP during booking - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// While signed out, choosing a show asks the user to sign in: checks the email OTP step (wrong OTP, Clear, correct OTP)
// and that the booking can carry on with the same date and show. Nothing is booked.
// Not automated here: the bank OTP (3-D Secure) of a card payment - there is no test credit card for UAT.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { closeMessage, messagePopup, myAccountLink, otpDialog, signInDialog, submitOtp, submitSignIn } from '../pages/Account'; // Sign-in steps.
import { chooseShow, dateTab, openShowTime, type Show } from '../pages/Booking'; // Show choice.

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in on the slow UAT site).

test('WEB-35 OTP during booking', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  const chosenTab = () => dateTab(page, show.day); // Date tab of that show.

  await step("While signed out, choose tomorrow's show and check SIGN IN opens", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // Clicks a show tomorrow.
    await expect(signInDialog(page), 'Choosing a show while signed out should ask to sign in').toBeVisible({ timeout: 30_000 });
  });

  await step('Enter email and password and check VERIFY EMAIL OTP says where the OTP was sent', async () => {
    await submitSignIn(page, username, password); // Email and password.
    await expect(otpDialog(page)).toBeVisible({ timeout: 60_000 }); // VERIFY EMAIL OTP.
    const text = await otpDialog(page).innerText(); // Its message (not printed: it names the account).
    expect.soft(text, 'The OTP dialog should say the OTP was sent to the registered email').toMatch(/sent|registered/i);
    expect.soft(text.includes(username), 'The email should not be shown in full').toBe(false);
  });

  await step('Enter a wrong OTP, check the message, then Clear', async () => {
    const wrongOtp = pin.split('').map((digit) => String((Number(digit) + 1) % 10)).join(''); // Every digit +1.
    await submitOtp(page, wrongOtp); // Wrong OTP.
    await expect(messagePopup(page)).toContainText('Otp entered is invalid', { timeout: 30_000 }); // Clear message.
    await closeMessage(page); // OK.
    await otpDialog(page).getByRole('button', { name: /clear/i }).click(); // Clear the boxes.
    await expect.poll(() => otpDialog(page).locator('input[type="tel"]').evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).value).join('')))
      .toBe(''); // All boxes are empty.
    await expect(myAccountLink(page)).toHaveCount(0); // Not signed in.
  });

  await step('Enter the correct OTP and check the booking carries on with the same date and show', async () => {
    await submitOtp(page, pin); // Correct OTP.
    await expect(otpDialog(page)).toBeHidden({ timeout: 30_000 }); // Dialog closes.
    await expect(myAccountLink(page)).toBeAttached({ timeout: 30_000 }); // Signed in.
    // Expected: the chosen date stays selected. Seen on UAT (Sep 2026): the movie page reloads on "Today" (WEB-03 chooses the date again).
    const kept = await expect.poll(() => chosenTab().getAttribute('aria-selected'), { timeout: 20_000 }).toBe('true') // Given 20 s to settle after sign-in.
      .then(() => true, () => false);
    testInfo.annotations.push({ type: 'selection after sign-in', description: kept ? 'The chosen date stayed selected.' : 'The page went back to another date.' });
    expect.soft(kept, 'After sign-in the chosen date should stay selected').toBe(true);
    if (!kept) await chosenTab().click(); // Choose it again to carry on.
    await openShowTime(page, show.time); // Same show time; the booking carries on to "Select Seat Category".
  });
});
