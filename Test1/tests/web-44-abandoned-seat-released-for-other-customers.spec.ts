// WEB-44 Abandoned seat is released for other customers - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// User 1 (main test account) holds one seat for tomorrow's show up to the payment page and leaves without paying or
// cancelling. User 2 (second test account, separate browser) checks the seat cannot be reserved while held, then tries
// again every 30 s until it can (expected when the 4-minute TIME REMAINING hold ends), and cancels. Nothing is paid.
// Why a second account and real reservation tries: on UAT (1 Oct 2026) the seat map does not reliably show a held seat
// as Unavailable (the holder's own account always sees it as free), but reserving a held seat is refused.
// Also seen on UAT (1 Oct 2026): even when user 1 stays on the payment page until the timer ends ("Give more time" at
// 1:00, then "Timeout please try again later" at 0:00), the site sends no release request and the seat stays held, so
// waiting longer in this test cannot make it pass - the release has to come from the site.
// If the site frees the seat as soon as user 1 leaves (sooner than the timer), the test passes as well: the expected
// result allows an earlier release, and double booking while a seat is really held is checked in WEB-38.
// (Until 4 Oct 2026 this was WEB-29; WEB-29 now checks the same customer going back and taking the seat again.)
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, test accounts), step() and secondUser (second browser).
import { flatText } from '../pages/BookingChecks'; // Text helper.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, clickSeat, clickShowSignedOut, proceedToSeatMap,
  proceedWithFreeSeats, readPaymentSummary, seatIds, seatState, signInAndReopenShow, skipFood, tryToReserveSeat,
  type Show,
} from '../pages/Booking';
import { openHome } from '../pages/WebSite'; // Opens the homepage.

test.describe.configure({ timeout: 720_000 }); // Up to 12 minutes (the seat hold alone is about 4 minutes).
const HOLD_LIMIT_MIN = 6; // Allowed time until the seat is free again: the 4-minute hold plus 2 minutes for the slow UAT site.

test('WEB-44 Abandoned seat is released for other customers', async ({ page, step, testConfig, secondUser }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  const second = testConfig.secondAccount; // The second test account (user 2).
  test.skip(!second.username || !second.password || !second.pin, 'Set TEST2_USERNAME, TEST2_PASSWORD and TEST2_PIN (second test account) to run this test.');
  const page2 = secondUser.page; // User 2's page.
  let show: Show; // The show chosen.
  let seatId = ''; // The seat held.
  let seatName = ''; // Its row and number, e.g. "K18".
  let heldAt = 0; // When the payment page (and the hold) started.
  let releasedAtOnce = false; // User 2 could reserve the seat as soon as user 1 left.

  await step("User 1 (main test account): hold one seat for tomorrow's show up to the payment page and note TIME REMAINING", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await proceedToSeatMap(page); // Seat map.
    // A free seat at the back of the map: if the hold outlasts the test, it does not get in the way of the other tests,
    // which choose seats from the front (row K).
    seatId = (await seatIds(page, 'available')).at(-1) ?? ''; // Last free seat in map order.
    await clickSeat(page, seatId); // Select it.
    expect(await seatState(page, seatId), 'User 1 should be able to select a free seat').toBe('selected');
    const held = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (another free seat if this one is held).
    [seatId] = held.seats; // The seat now held,
    [seatName] = held.names; // e.g. "A1".
    if (held.next === 'food') await skipFood(page); // To the payment page.
    heldAt = Date.now(); // The hold starts here.
    await readPaymentSummary(page); // Payment summary loaded.
    let timer = ''; // e.g. "03:58" (drawn a moment after the summary).
    await expect.soft.poll(async () => (timer = flatText(await page.locator('body').innerText()).match(/time remaining\s*:?\s*(\d{1,2}:\d{2})/i)?.[1] ?? ''),
      { message: 'The payment page should show TIME REMAINING', timeout: 15_000 }).not.toBe('');
    testInfo.annotations.push({ type: 'seat hold', description: `Seat ${seatName} held; TIME REMAINING ${timer || 'not shown'}.` });
  });

  await step('User 1 leaves the payment page without paying or cancelling', async () => {
    await openHome(page, testConfig.urls.home); // Walk away to the homepage (like closing the tab).
  });

  // User 2 tries to reserve the seat (seat map, select, PROCEED): 'food' / 'payment' = reserved, 'refused' = still held.
  // A page that does not load in time (UAT sometimes shows a blank page for a while) counts as one failed try.
  const tryToReserve = () => tryToReserveSeat(page2, testConfig.urls.home, show, seatId)
    .catch((error: Error) => ({ shown: 'unknown', outcome: `page did not load (${error.message.split(/\r?\n/)[0].slice(0, 80)})` }));

  await step('User 2 (second test account): sign in in a second browser and check the held seat cannot be reserved', async () => {
    await clickShowSignedOut(page2, testConfig.urls.home, show); // Same movie, date and time; the sign-in dialog opens.
    await signInAndReopenShow(page2, second, show); // Second account: email, password, OTP; same show again.
    let attempt = await tryToReserve(); // Seat map, select, PROCEED.
    if (attempt.outcome.startsWith('page did not load')) attempt = await tryToReserve(); // A slow page: try once more.
    testInfo.annotations.push({ type: 'seat while held', description: `${Math.round((Date.now() - heldAt) / 1000)} s after user 1 left, user 2 sees ${seatName} as "${attempt.shown}"; reserving it: ${attempt.outcome}.` });
    await secondUser.shot(`${seatName} while user 1 holds it`);
    releasedAtOnce = attempt.outcome === 'food' || attempt.outcome === 'payment'; // User 2 got it (kept for the last step).
    if (releasedAtOnce) { // Freed when user 1 left: sooner than the timer, which the expected result allows.
      testInfo.annotations.push({ type: 'seat released', description: `${seatName} was free again as soon as user 1 left the payment page (no wait for the timer).` });
      return;
    }
    expect(['refused', 'not selectable'], `While user 1 holds ${seatName}, user 2 must not be able to reserve it`).toContain(attempt.outcome);
    // The seat map is cached for about a minute, so a just-held seat can still be drawn as free; the refusal above is what counts.
    notOnUat(attempt.shown === 'unavailable', `${seatName} held by user 1 is still drawn as "${attempt.shown}" on user 2's seat map (seat map cached for about a minute).`);
  });

  await step(`User 2 tries again every 30 s until the seat can be reserved (expected within ${HOLD_LIMIT_MIN} minutes)`, async () => {
    if (releasedAtOnce) return; // User 2 already has the seat.
    const tries: string[] = []; // What each try showed.
    try {
      await expect.poll(async () => {
        await page2.waitForTimeout(30_000); // 30 s between tries.
        const attempt = await tryToReserve(); // Seat map, select, PROCEED.
        tries.push(`${((Date.now() - heldAt) / 60_000).toFixed(1)} min: shown "${attempt.shown}", ${attempt.outcome}`);
        return attempt.outcome === 'food' || attempt.outcome === 'payment'; // Reserved = the hold has ended.
      }, { message: `The unpaid seat should be free again within ${HOLD_LIMIT_MIN} minutes (seen on UAT, 1 Oct 2026: still held after 35 minutes)`,
        timeout: (HOLD_LIMIT_MIN + 2) * 60_000, intervals: [1_000] }).toBe(true);
    } finally {
      testInfo.annotations.push({ type: 'reservation tries by user 2', description: tries.join('; ') }); // Evidence, also when it times out.
    }
    const minutes = (Date.now() - heldAt) / 60_000; // Time the seat stayed held.
    testInfo.annotations.push({ type: 'seat released', description: `User 2 reserved ${seatName} ${minutes.toFixed(1)} minutes after user 1's hold started.` });
    expect.soft(minutes, `The seat should be released within ${HOLD_LIMIT_MIN} minutes`).toBeLessThanOrEqual(HOLD_LIMIT_MIN);
  });

  await step('User 2 has the seat on the payment page; cancel (nothing is paid)', async () => {
    if (/\/food\//.test(page2.url())) await skipFood(page2); // Today's show: past the food page.
    const summary = await readPaymentSummary(page2); // It can be booked again.
    expect(summary.seat, `User 2's payment page should show ${seatName}`).toBe(seatName);
    await secondUser.shot(`payment page with ${seatName}`);
    await cancelDuringBooking(page2); // Cancel > Yes; the seat is released.
  });
});
