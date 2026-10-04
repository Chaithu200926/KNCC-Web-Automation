// WEB-29 Unpaid seat is released for booking again - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// A customer chooses a seat for tomorrow's show and PROCEEDs to the next page (the payment page; the seat is now held
// for them), then changes their mind and goes back with the browser's Back button - no payment, no Cancel. Trying
// again straight away, the same seat must be free for them: shown as Available, selectable, and PROCEED reserves it
// again (payment page with the same seat). The booking is then cancelled; nothing is paid.
// Seen on UAT (1 Oct 2026): an account sees its own held seat as Available, but a new reservation of it was refused
// (blank /login page) and an abandoned hold lasted far longer than the 4-minute timer. This test shows whether going
// back frees the seat for the same customer.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { flatText } from '../pages/BookingChecks'; // Text helper.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, clickSeat, proceedToSeatMap, proceedWithFreeSeats,
  readPaymentSummary, reopenSeatMap, seatIds, seatState, signInAndReopenShow, skipFood, tryProceedFromSeatMap,
  type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (sign-in and the seat map twice on the slow UAT site).

test('WEB-29 Unpaid seat is released for booking again', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show; // The show chosen.
  let seatId = ''; // The seat held.
  let seatName = ''; // Its row and number, e.g. "K18".
  let paymentUrl = ''; // The first payment page (to cancel that hold if the test stops early).
  let wentBackAt = 0; // When the customer went back.
  let reservedAgain = false; // The second PROCEED reserved the seat.
  const secondsSinceBack = () => Math.round((Date.now() - wentBackAt) / 1000);

  try {
    await step("Sign in, choose tomorrow's show and a free seat, and PROCEED to the payment page (the seat is held)", async () => {
      show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
      await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
      await chooseCategoryAndType(page); // General / Standard, 1 ticket.
      await proceedToSeatMap(page); // Seat map.
      // A free seat at the back of the map: if a hold outlasts the test, it does not get in the way of the other tests.
      seatId = (await seatIds(page, 'available')).at(-1) ?? ''; // Last free seat in map order.
      await clickSeat(page, seatId); // Select it.
      expect(await seatState(page, seatId), 'A free seat should be selectable').toBe('selected');
      const held = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (another free seat if this one is held).
      [seatId] = held.seats; // The seat now held,
      [seatName] = held.names; // e.g. "A1".
      if (held.next === 'food') await skipFood(page); // To the payment page.
      const summary = await readPaymentSummary(page); // Payment summary.
      expect(summary.seat, `The payment page should show ${seatName}`).toBe(seatName);
      paymentUrl = page.url();
      let timer = ''; // e.g. "03:58" (drawn a moment after the summary).
      await expect.soft.poll(async () => (timer = flatText(await page.locator('body').innerText()).match(/time remaining\s*:?\s*(\d{1,2}:\d{2})/i)?.[1] ?? ''),
        { message: 'The payment page should show TIME REMAINING', timeout: 15_000 }).not.toBe('');
      testInfo.annotations.push({ type: 'seat held', description: `${seatName} held on the payment page; TIME REMAINING ${timer || 'not shown'}.` });
    });

    await step('Go back with the browser Back button (no payment, no Cancel)', async () => {
      page.once('dialog', (dialog) => { dialog.accept().catch(() => undefined); }); // "Leave this page?" if the site asks.
      await page.goBack({ waitUntil: 'commit' }); // Back.
      // From a show today Back first reaches the food page; keep going back until off the booking pages (at most 3 times).
      for (let i = 0; i < 3 && /\/(?:payment|food)\//.test(page.url()); i += 1) await page.goBack({ waitUntil: 'commit' });
      wentBackAt = Date.now(); // The quick retry is timed from here.
      await page.waitForTimeout(2_000); // Let the page draw.
      testInfo.annotations.push({ type: 'after Back', description: `The browser went back to ${new URL(page.url()).pathname}.` });
    });

    await step('Try again straight away: check the same seat is shown as Available on the seat map', async () => {
      // If Back landed on the seat map with the seats drawn, the customer tries again right there; otherwise they open
      // the same show again (movie page, date, show time, General / Standard).
      const onSeatMap = /\/seatlayout/.test(page.url()) && await page.locator('.seat[id]').first().isVisible().catch(() => false);
      if (!onSeatMap) await reopenSeatMap(page, testConfig.urls.home, show);
      const shown = await seatState(page, seatId); // How the seat is drawn now.
      testInfo.annotations.push({ type: 'seat after going back', description: `${secondsSinceBack()} s after going back (${onSeatMap ? 'on the seat map Back returned to' : 'show opened again'}), ${seatName} is shown as "${shown}".` });
      expect(['available', 'selected'], `${seatName} should be free again for the same customer right after going back`).toContain(shown);
    });

    await step('Select the same seat and PROCEED; check it is reserved again (payment page with the same seat)', async () => {
      if (await seatState(page, seatId) !== 'selected') await clickSeat(page, seatId); // Select it (unless still selected).
      expect(await seatState(page, seatId), `${seatName} should be selectable again`).toBe('selected');
      const next = await tryProceedFromSeatMap(page); // PROCEED.
      testInfo.annotations.push({ type: 'second PROCEED', description: `${secondsSinceBack()} s after going back: ${next} (now on ${new URL(page.url()).pathname}).` });
      expect(next, `${seatName} should be reserved again right after going back (seen on UAT, 1 Oct 2026: a seat the account already held was refused with a blank /login page)`)
        .toMatch(/^(?:food|payment)$/);
      reservedAgain = true;
      if (next === 'food') await skipFood(page); // To the payment page.
      const summary = await readPaymentSummary(page); // Payment summary.
      expect(summary.seat, `The payment page should show the same seat ${seatName}`).toBe(seatName);
    });

    await step('Cancel the booking (nothing is paid)', async () => {
      await cancelDuringBooking(page); // Cancel > Yes; the seat is released.
    });
  } finally {
    // If the seat was not reserved again, the first hold may still be there: open that payment page and Cancel it, so
    // the seat does not stay blocked for the other tests (best effort).
    if (!reservedAgain && paymentUrl) {
      await page.goto(paymentUrl, { waitUntil: 'commit' }).then(() => cancelDuringBooking(page)).catch(() => undefined);
    }
  }
});
