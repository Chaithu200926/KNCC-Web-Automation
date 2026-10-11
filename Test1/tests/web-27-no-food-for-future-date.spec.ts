// WEB-27 No food for a future-date booking - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// On the website, food can only be added to a ticket for today's show. Also checks the payment page timer counts down.
// Uses the test account; nothing is paid.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, proceedToSeatMap, proceedWithFreeSeats, readPaymentSummary,
  selectAvailableSeats, signInAndReopenShow, type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in and seat map on the slow UAT site).

test('WEB-27 No food for a future-date booking', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');

  let show: Show; // The show chosen.

  await step("Choose tomorrow's show and sign in", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
  });

  await step('Choose General / Standard and a free seat', async () => {
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
  });

  await step('Proceed and check the site goes straight to payment, with no food page', async () => {
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    expect(next, "Tomorrow's show should go straight to payment (no food page)").toBe('payment');
    await expect(page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i })).toHaveCount(0); // No food step.
    const summary = await readPaymentSummary(page); // Payment summary.
    expect(summary.text, 'The payment summary should list tickets only').not.toMatch(/food price\s*KWD\s*[1-9]/i); // No food charged.
  });

  await step('Check the booking timer (Time remaining) counts down', async () => {
    const remaining = async () => { // Seconds left, from "Time remaining 03:57".
      const shown = (await page.locator('body').innerText()).match(/time remaining\s*(\d{1,2}):(\d{2})/i);
      return shown ? Number(shown[1]) * 60 + Number(shown[2]) : Number.NaN;
    };
    const first = await remaining();
    expect(first, 'The payment page should show Time remaining (mm:ss)').toBeGreaterThan(0);
    await page.waitForTimeout(5_000); // Wait 5 seconds.
    const second = await remaining();
    testInfo.annotations.push({ type: 'time remaining', description: `${first} s, then ${second} s five seconds later.` });
    expect(second, 'Time remaining should go down').toBeLessThan(first);
    expect(first - second, 'Time remaining should go down by about 5 seconds').toBeGreaterThanOrEqual(3);
  });

  await step('Cancel the booking (nothing is paid)', async () => {
    await cancelDuringBooking(page); // Cancel; the seat is released.
  });
});
