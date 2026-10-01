// WEB-25 Seat map rules - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// With 2 General / Standard tickets for tomorrow's show: checks the seat map (title, legend, SCREEN), that unavailable
// seats cannot be chosen, that no more seats than tickets can be chosen, that a seat can be deselected, and that
// PROCEED needs exactly 2 seats. Uses the test account; the booking is cancelled before paying.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, clickSeat, closeOpenMessage, openMessage, proceedFromSeatMap,
  proceedToSeatMap, seatIds, seatState, selectAvailableSeats, setTicketCount, signInAndReopenShow,
} from '../pages/Booking';

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in and seat map on the slow UAT site).
const TICKETS = 2; // Tickets chosen before the seat map.

test('WEB-25 Seat map rules', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  const selected = () => seatIds(page, 'selected'); // Ids of the seats chosen so far.
  const proceed = page.getByRole('button', { name: 'PROCEED', exact: true }).last(); // PROCEED under the seat map.
  let chosen: string[] = []; // The seats chosen.

  await step(`Choose tomorrow's show, sign in, choose ${TICKETS} General / Standard tickets and PROCEED to the seat map`, async () => {
    const show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard.
    await setTicketCount(page, TICKETS); // 2 tickets.
    await proceedToSeatMap(page); // Seat map.
  });

  await step('Check CHOOSE YOUR SEAT, the legend (Available, Unavailable, Selected) and SCREEN', async () => {
    await expect(page.getByText(/choose\s+your\s+seat/i).first()).toBeVisible(); // Title "CHOOSE YOUR SEAT".
    for (const label of ['Available', 'Unavailable', 'Selected']) { // Legend.
      await expect.soft(page.locator('.seats-info-box').filter({ hasText: new RegExp(`^${label}$`) }), `Legend: ${label}`).toBeVisible();
    }
    await expect.soft(page.getByText(/^screen$/i).first(), 'SCREEN should be shown').toBeVisible(); // Screen position.
    await expect(proceed, 'PROCEED should not work before any seat is chosen').toBeDisabled(); // Greyed out at first.
  });

  await step('Click an unavailable seat and check it cannot be selected', async () => {
    const unavailable = await seatIds(page, 'unavailable'); // Sold / held seats, and seats of the other category (Family).
    testInfo.annotations.push({ type: 'unavailable seats', description: unavailable.length
      ? `${unavailable.length} seat(s) shown as Unavailable.`
      : 'No seat is shown as Unavailable on this show, so this rule was not checked.' });
    if (!unavailable.length) return; // Nothing to try on this show.
    await clickSeat(page, unavailable[0]); // Try to choose it.
    expect(await seatState(page, unavailable[0]), 'An unavailable seat should stay Unavailable').toBe('unavailable');
    expect(await selected(), 'No seat should be selected').toEqual([]);
  });

  await step(`Select ${TICKETS} seats and check each shows as Selected`, async () => {
    chosen = await selectAvailableSeats(page, TICKETS); // Two free seats.
    for (const id of chosen) expect(await seatState(page, id), `Seat ${id} should show as Selected`).toBe('selected');
    expect(await selected(), `Exactly ${TICKETS} seats should be selected`).toHaveLength(TICKETS);
    await expect(proceed, 'PROCEED should be offered').toBeEnabled();
  });

  await step(`Try to select one seat more than ${TICKETS}; check it is not added and the site says so`, async () => {
    const extra = (await seatIds(page, 'available'))[0]; // Another free seat.
    await clickSeat(page, extra); // Try to choose it.
    await expect.soft(openMessage(page), 'The site should say how many seats may be chosen').toContainText(new RegExp(`select only ${TICKETS} seat`, 'i')); // "Please select only 2 seat(s)".
    if (await openMessage(page).count()) await closeOpenMessage(page); // OK.
    expect(await seatState(page, extra), 'The extra seat should not be selected').toBe('available');
    expect(await selected(), `Still exactly ${TICKETS} seats should be selected`).toHaveLength(TICKETS);
  });

  await step('Click a selected seat again and check it goes back to Available', async () => {
    await clickSeat(page, chosen[0]); // Deselect the first seat.
    expect(await seatState(page, chosen[0]), 'The deselected seat should be Available again').toBe('available');
    expect(await selected(), 'One seat should be left selected').toEqual([chosen[1]]);
  });

  await step(`Click PROCEED with 1 of ${TICKETS} seats and check it does not continue`, async () => {
    await proceed.click(); // PROCEED with too few seats.
    await expect.soft(openMessage(page), `The site should ask for ${TICKETS} seats`).toContainText(new RegExp(`select ${TICKETS}\\s*seat`, 'i')); // "Please select 2seat".
    if (await openMessage(page).count()) await closeOpenMessage(page); // OK.
    await expect(page, 'The seat map should stay open').toHaveURL(/\/seatlayout/);
  });

  await step(`Select a second seat again and check PROCEED continues (then cancel; nothing is paid)`, async () => {
    chosen = [chosen[1], ...await selectAvailableSeats(page, 1)]; // Back to 2 seats.
    expect(await selected(), `Exactly ${TICKETS} seats should be selected`).toHaveLength(TICKETS);
    const next = await proceedFromSeatMap(page); // PROCEED: food page (today) or payment page (tomorrow).
    testInfo.annotations.push({ type: 'after the seat map', description: `PROCEED went to the ${next} page.` });
    await cancelDuringBooking(page); // Cancel > Yes; the seats are released.
  });
});
