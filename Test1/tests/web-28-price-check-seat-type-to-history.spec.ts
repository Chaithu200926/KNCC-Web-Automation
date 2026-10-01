// WEB-28 Price check from seat type to history - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Books 2 General / Standard tickets plus one food item for a show later today, follows the price from the seat type
// to the quantity box, the food page, the payment page, the confirmation page and My Account > HISTORY, pays with the
// test account's wallet, then cancels the booking and checks how much goes back to the wallet (food included?).
// "Soft" checks (expect.soft) report a problem but let the test carry on (and still cancel the booking).
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { openAccountTab, openMyAccount } from '../pages/Account'; // My Account and its tabs.
import { fils, flatText, hoursUntilShow, readKwd, readKwdAfter, readWalletBalance } from '../pages/BookingChecks'; // Amount helpers.
import { // Booking steps (see pages/Booking.ts):
  cancelBookingInMyProfile, chooseCategoryAndType, chooseShow, openBookings, openMessage, payWithWallet, proceedFromSeatMap,
  proceedToSeatMap, quantity, readPaymentSummary, selectAvailableSeats, setTicketCount, signInAndReopenShow, type Show,
} from '../pages/Booking';
import { addFood, foodItems, foodPageTotal, foodPrice, openedFoodPage, proceedFromFood } from '../pages/Food'; // Food page steps.
import { appears } from '../pages/WebSite'; // Waits for a pop-up.

test.describe.configure({ timeout: 360_000 }); // Up to 6 minutes (booking, history and cancellation on the slow UAT site).
const TICKETS = 2; // Tickets of one seat type.
const kwd = (amount: number | undefined) => `KWD ${(amount ?? Number.NaN).toFixed(3)}`; // 3.5 → "KWD 3.500".

test('WEB-28 Price check from seat type to history', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show | undefined; // Today's show.
  let price = 0; // One General / Standard ticket.
  let food = 0; // The food item.
  let itemName = ''; // Its name.
  let total = 0; // Tickets + food.
  let booking = { bookingId: '', dateTime: '', grandTotal: undefined as number | undefined }; // The paid booking.

  await step('Choose a show later today (3 hours or more away), sign in and note the General / Standard price', async () => {
    show = await chooseShow(page, testConfig.urls.home, 'today', 3).catch(() => undefined); // Far enough ahead to cancel afterwards.
    test.skip(!show, 'No homepage movie has a show 3 hours or more from now; run this test earlier in the day.');
    await signInAndReopenShow(page, testConfig.credentials, show!); // Email, password, OTP; same show again.
    price = await chooseCategoryAndType(page); // General / Standard; price on the seat type, e.g. 3.5.
    expect(price, 'The Standard seat type should show a price').toBeGreaterThan(0);
  });

  await step(`Choose ${TICKETS} tickets; check the quantity total = price x ${TICKETS}`, async () => {
    await setTicketCount(page, TICKETS); // 2 tickets.
    expect(fils(readKwd(await quantity(page).total.innerText())), `Quantity total should be ${TICKETS} x ${kwd(price)}`).toBe(fils(price) * TICKETS);
  });

  await step(`Choose ${TICKETS} seats and add one food item; check the food page TOTAL = tickets + food`, async () => {
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, TICKETS); // Two free seats.
    expect(await proceedFromSeatMap(page), "Today's show should offer food").toBe('food'); // Food page.
    expect.soft(fils(await openedFoodPage(page)), 'Food page TOTAL before food = the tickets').toBe(fils(price) * TICKETS);
    const item = foodItems(page).first(); // First item of the first category, e.g. "Combo 2".
    itemName = (await item.locator('h4').innerText()).trim();
    food = (await foodPrice(item)) ?? Number.NaN; // e.g. 2.
    await addFood(page, item); // Add > options > Done.
    total = (fils(price) * TICKETS + fils(food)) / 1000; // Expected total in KWD.
    await expect.poll(async () => fils(await foodPageTotal(page)), { message: `Food page TOTAL should be ${kwd(total)}` }).toBe(fils(total));
    testInfo.annotations.push({ type: 'order', description: `${TICKETS} x ${kwd(price)} + ${itemName} ${kwd(food)} = ${kwd(total)}` });
  });

  await step('Proceed; check the payment page: Ticket Price x 2, Food Price and Total amount to be paid', async () => {
    await proceedFromFood(page); // Payment page.
    const summary = await readPaymentSummary(page); // Order summary.
    expect.soft(fils(summary.ticketPrice), 'Payment page: ticket price').toBe(fils(price)); // "Ticket Price KWD 3.500
    expect.soft(summary.tickets, 'Payment page: number of tickets').toBe(TICKETS); // x 2
    expect.soft(fils(summary.ticketsTotal), 'Payment page: tickets total').toBe(fils(price) * TICKETS); // KWD 7.000"
    expect.soft(fils(summary.food), 'Payment page: Food Price').toBe(fils(food));
    expect(fils(summary.total), 'Payment page: Total amount to be paid = tickets + food (no discount)').toBe(fils(total));
  });

  await step('Pay with the wallet; check the confirmation page Grand Total', async () => {
    booking = await payWithWallet(page); // Use your Wallet > Apply > Proceed; confirmation page.
    testInfo.annotations.push({ type: 'paid booking', description: `${booking.bookingId}, ${booking.dateTime}, Grand Total ${kwd(booking.grandTotal)}` });
    expect.soft(fils(booking.grandTotal), 'Confirmation page: Grand Total').toBe(fils(total));
    await expect.soft(page.locator('body'), `Confirmation page should list the food (${kwd(food)})`).toContainText(kwd(food));
    const foodTips = openMessage(page); // With food, a pop-up "One Click & Your Snacks Are Ready – Here's How!" (video, Close) opens.
    if (await appears(foodTips, 15_000)) { // Shown a moment after the confirmation page opens.
      testInfo.annotations.push({ type: 'confirmation pop-up', description: flatText(await foodTips.innerText()) });
      await foodTips.getByRole('button', { name: /close/i }).click(); // Close it (it blocks the page).
      await expect(foodTips).toHaveCount(0);
    }
  });

  await step('Check My Account > HISTORY shows the same amounts', async () => {
    await openMyAccount(page); // My Account.
    await openAccountTab(page, 'HISTORY'); // HISTORY tab.
    const card = page.locator('.movie_section').filter({ visible: true }).filter({ hasText: booking.bookingId }).first(); // This booking.
    await expect(card, `HISTORY should list booking ${booking.bookingId}`).toBeVisible({ timeout: 30_000 });
    await card.getByText(/^view details$/i).click(); // View Details.
    await expect(page.getByText(/^close details$/i).filter({ visible: true }).first()).toBeVisible(); // Expanded (Close Details).
    const expanded = page.locator('div').filter({ visible: true }).filter({ has: page.getByText(/^close details$/i) })
      .filter({ hasText: /grand total/i }).filter({ hasText: booking.bookingId }).last(); // The expanded block (as in WEB-38).
    const details = flatText(await expanded.innerText()); // Ticket details and transaction details.
    testInfo.annotations.push({ type: 'history details', description: details });
    const ticketPrice = readKwdAfter(details, 'Ticket Price'); // The ticket line.
    const foodPrice = readKwdAfter(details, 'Food Price'); // The food line.
    const paid = readKwdAfter(details, 'Wallet'); // Amount paid by wallet.
    expect.soft(fils(ticketPrice), `HISTORY: Ticket Price ${kwd(ticketPrice)} should be the tickets total ${kwd(price * TICKETS)}, as on the payment and confirmation pages`).toBe(fils(price) * TICKETS);
    expect.soft(fils(foodPrice), 'HISTORY: Food Price').toBe(fils(food));
    expect.soft(fils(paid), 'HISTORY: amount paid by wallet').toBe(fils(total));
    expect.soft(fils(ticketPrice) + fils(foodPrice), `HISTORY: Ticket Price + Food Price should add up to the ${kwd(paid)} paid`).toBe(fils(paid));
  });

  await step('Cancel the booking; check the wallet gets back the full amount, food included', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const walletAfterBooking = await readWalletBalance(page); // Balance before the refund.
    expect(hoursUntilShow(booking.dateTime), 'The show should still be 2 hours or more away (cancellation allowed)').toBeGreaterThanOrEqual(2);
    await cancelBookingInMyProfile(page, booking.bookingId, show!.title); // Cancel Booking > Yes, I'm sure.
    await openBookings(page); // The site goes to the homepage after cancelling: back to My Account > BOOKINGS.
    await expect(page.locator('body'), `${booking.bookingId} should leave UPCOMING BOOKINGS`).not.toContainText(booking.bookingId, { timeout: 30_000 });
    let refund = 0; // Amount credited back.
    await expect.poll(async () => { // The refund can take a moment: reload until the balance changes (up to 1 minute).
      refund = (fils(await readWalletBalance(page)) - fils(walletAfterBooking)) / 1000;
      if (refund === 0) await page.reload({ waitUntil: 'domcontentloaded' });
      return refund;
    }, { message: 'The wallet should be credited after cancelling', timeout: 60_000 }).toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'refund', description: `${kwd(refund)} back to the wallet (tickets ${kwd(price * TICKETS)}, food ${kwd(food)}).` });
    expect.soft(fils(refund), `The refund should be the full ${kwd(booking.grandTotal)}, food included`).toBe(fils(booking.grandTotal));
  });
});
