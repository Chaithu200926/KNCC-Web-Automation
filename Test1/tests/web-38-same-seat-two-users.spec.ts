// WEB-38 Same seat chosen by two users - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Two test accounts in two separate browsers choose the same free seat of tomorrow's show. User 1 (main test account)
// clicks PROCEED first and holds the seat; then user 2 (second test account) clicks PROCEED and must be refused.
// After user 1 cancels, the seat must be free for user 2. Nothing is paid, and user 2 never holds a seat.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test accounts), step() and secondUser (second browser).
import { flatText } from '../pages/BookingChecks'; // Text helper.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, clickSeat, clickShowSignedOut, proceedFromSeatMap,
  proceedToSeatMap, readPaymentSummary, reopenSeatMap, seatIds, seatLabel, seatState, signInAndReopenShow, skipFood,
  type Show,
} from '../pages/Booking';

test.describe.configure({ timeout: 420_000 }); // Up to 7 minutes (two sign-ins and several seat maps on the slow UAT site).

test('WEB-38 Same seat chosen by two users', async ({ page, step, testConfig, secondUser }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  const second = testConfig.secondAccount; // The second test account (user 2).
  test.skip(!second.username || !second.password || !second.pin, 'Set TEST2_USERNAME, TEST2_PASSWORD and TEST2_PIN (second test account) to run this test.');
  const page2 = secondUser.page; // User 2's page (separate browser, own sign-in).
  const shotOfUser2 = secondUser.shot; // Evidence of user 2's screen.
  const message2 = page2.locator('.swal-overlay--show-modal .swal-modal, .swal2-popup').filter({ visible: true }).first(); // A message on user 2's screen.
  let show: Show; // The show both users open.
  let seatId = ''; // The seat both users choose.
  let seatName = ''; // Its row and number, e.g. "K18".
  // User 2 opens the show's seat map again and reads the seat. A page that does not load in time (UAT sometimes shows a
  // blank page for a while; on CI, 1 Oct 2026, one slow page ended the whole wait) counts as one try.
  const seatOnFreshMap = () => reopenSeatMap(page2, testConfig.urls.home, show).then(() => seatState(page2, seatId), () => 'other' as const);

  try {
    await step("User 1 (main test account): choose tomorrow's show, sign in, choose General / Standard and open the seat map", async () => {
      show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
      await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
      await chooseCategoryAndType(page); // General / Standard, 1 ticket.
      await proceedToSeatMap(page); // Seat map.
    });

    await step('User 2 (second test account): sign in in a second browser and open the seat map of the same show', async () => {
      await clickShowSignedOut(page2, testConfig.urls.home, show); // Same movie, date and time; the sign-in dialog opens.
      await signInAndReopenShow(page2, second, show); // Second account: email, password, OTP; same show again.
      await chooseCategoryAndType(page2); // General / Standard, 1 ticket.
      await proceedToSeatMap(page2); // Seat map.
      await shotOfUser2('seat map of the same show');
    });

    await step('Both users choose the same free seat', async () => {
      const freeForUser2 = await seatIds(page2, 'available'); // Free seats on user 2's map.
      seatId = (await seatIds(page, 'available')).find((id) => freeForUser2.includes(id)) ?? ''; // First seat free for both.
      expect(seatId, 'A seat should be free for both users').not.toBe('');
      seatName = await seatLabel(page, seatId); // e.g. "K18".
      testInfo.annotations.push({ type: 'seat', description: `Both users choose ${seatName} (${show.movieTitle}, ${show.day}, ${show.time}).` });
      await clickSeat(page, seatId); // User 1 selects it.
      await clickSeat(page2, seatId); // User 2 selects it.
      expect(await seatState(page, seatId), 'User 1: the seat should be Selected').toBe('selected');
      expect(await seatState(page2, seatId), 'User 2: the seat should be Selected').toBe('selected');
      await shotOfUser2(`${seatName} selected`);
    });

    await step('User 1 clicks PROCEED first and holds the seat', async () => {
      if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // To the payment page (the seat is now held).
      const summary = await readPaymentSummary(page); // User 1's order summary.
      expect(summary.seat, `User 1's payment page should show seat ${seatName}`).toBe(seatName);
    });

    await step('User 2 clicks PROCEED; check user 2 cannot go on (no double booking) and sees a clear "seat not available" message', async () => {
      const reservation = page2.waitForResponse((response) => /\/trans\/reserveseats/i.test(response.url()) && response.request().method() === 'POST', { timeout: 30_000 })
        .catch(() => undefined); // The site's seat reservation request for user 2.
      await page2.getByRole('button', { name: 'PROCEED', exact: true }).last().click(); // PROCEED with the same seat.
      const answer = await reservation; // The reservation answer (seen on UAT, 1 Oct 2026: HTTP 200 with an empty body).
      const answerText = answer ? `HTTP ${answer.status()}, body: ${(await answer.text().catch(() => '')).slice(0, 200) || '(empty)'}` : 'no reservation request seen';
      await expect.poll(async () => await message2.isVisible().catch(() => false) || !/\/seatlayout/.test(page2.url()), // A message, or user 2 left the seat map.
        { message: 'User 2 should get an answer within 30 s', timeout: 30_000 }).toBe(true);
      await page2.waitForTimeout(2_000); // Let the next screen draw.
      await shotOfUser2('after PROCEED');
      const shown = await message2.isVisible().catch(() => false) ? flatText(await message2.innerText()) : ''; // The message, if any.
      const now = new URL(page2.url()).pathname; // Where user 2 is now, e.g. "/seatlayout" or "/login".
      testInfo.annotations.push({ type: 'user 2 after PROCEED', description: `Reservation: ${answerText}. User 2 is on ${now}. Message: ${shown || 'none'}.` });
      const reachedBooking = /^\/(?:food|payment)\//.test(now); // User 2 got through with a seat user 1 holds (double booking).
      if (reachedBooking) await cancelDuringBooking(page2); // Leave nothing held for user 2.
      expect(reachedBooking, `User 2 must not get to the food / payment page with ${seatName} while user 1 holds it`).toBe(false);
      expect.soft(shown, `User 2 should see a clear message that ${seatName} is no longer available (now on ${now})`)
        .toMatch(/not available|unavailable|already|reserved|booked|taken|another seat|blocked|sold/i);
      if (shown) await message2.getByRole('button').first().click(); // OK.
    });

    await step('User 2 opens the show again; check the seat shows as Unavailable', async () => {
      // The seat map can show a just-held seat as free for up to about a minute (seen on UAT, 1 Oct 2026), so user 2
      // reopens the show every 15 s, for up to 2 minutes, until the seat is drawn as Unavailable.
      const started = Date.now();
      await expect.soft.poll(seatOnFreshMap, { message: `User 2: ${seatName} should be shown as Unavailable while user 1 holds it`, timeout: 120_000, intervals: [15_000] }).toBe('unavailable');
      testInfo.annotations.push({ type: 'seat map after the hold', description: `User 2 sees ${seatName} as "${await seatState(page2, seatId)}" ${Math.round((Date.now() - started) / 1000)} s after reopening.` });
      await shotOfUser2(`${seatName} while user 1 holds it`);
    });

    await step('User 1 cancels; check the seat is free again for user 2 and user 2 can select it', async () => {
      await cancelDuringBooking(page); // User 1: Cancel > Yes; the seat is released.
      await expect.poll(async () => { // User 2 reopens the show until the seat is free (up to 2 minutes).
        if (await seatState(page2, seatId) === 'available') return 'available';
        return seatOnFreshMap(); // Same show, General / Standard, seat map.
      }, { message: `${seatName} should be free for user 2 after user 1 cancels`, timeout: 120_000, intervals: [5_000] }).toBe('available');
      await clickSeat(page2, seatId); // User 2 selects it (no PROCEED, so nothing is held).
      expect(await seatState(page2, seatId), `User 2 should now be able to select ${seatName}`).toBe('selected');
      await shotOfUser2(`${seatName} selected after user 1 cancelled`);
    });
  } finally {
    if (/\/(?:food|payment)\//.test(page.url())) await cancelDuringBooking(page).catch(() => undefined); // If the test stopped early: release user 1's seat.
  }
});
