// WEB-26 Food for today's show: add, change, remove, skip - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Books one seat for a show later today up to the food page, checks the food page, adds a combo (with its options),
// changes and removes it, goes on to payment with food, then starts again and uses SKIP & PROCEED.
// Uses the test account; both bookings are cancelled before paying. The seats are held for 4 minutes per booking.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { fils } from '../pages/BookingChecks'; // KWD → fils.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, proceedToSeatMap, proceedWithFreeSeats, readPaymentSummary,
  reopenSeatMap, selectAvailableSeats, signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';
import { // Food page steps (see pages/Food.ts):
  addFood, foodCategories, foodCount, foodItems, foodPageTotal, foodPrice, openedFoodPage, proceedFromFood, removeFoodControl,
} from '../pages/Food';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (sign-in and two bookings on the slow UAT site).
const CATEGORIES = ['Combos', 'Snacks', 'Popcorn', 'Beverages', 'Coffee & Tea', 'Chocolates', 'Healthy']; // Food categories.

test("WEB-26 Food for today's show: add, change, remove, skip", async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  let show: Show | undefined; // Today's show.
  let ticketsTotal = 0; // TOTAL on the food page before any food (= the ticket).
  const item = foodItems(page).first(); // The first item of the first category (Combos), e.g. "Combo 2".
  let itemName = ''; // Its name.
  let price = 0; // Its price in KWD.
  // Checks the food page TOTAL = ticket + food.
  const expectTotal = (food: number, when: string) => expect.poll(async () => fils(await foodPageTotal(page)),
    { message: `${when}: TOTAL should be KWD ${(ticketsTotal + food).toFixed(3)}` }).toBe(fils(ticketsTotal) + fils(food));

  await step('Choose a show later today, sign in, choose one General / Standard seat and PROCEED; check the food page opens', async () => {
    show = await chooseShow(page, testConfig.urls.home, 'today', 1).catch(() => undefined); // A show at least 1 hour from now.
    test.skip(!show, 'No homepage movie has a show later today; run this test earlier in the day.');
    await signInAndReopenShow(page, testConfig.credentials, show!); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard, 1 ticket.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show!); // PROCEED (other seats if one is held).
    expect(next, "Today's show should offer food").toBe('food'); // The food page opens.
    ticketsTotal = (await openedFoodPage(page)) ?? Number.NaN; // TOTAL = the ticket, e.g. 3.5.
    testInfo.annotations.push({ type: 'show', description: `${show!.movieTitle}, today ${show!.time}; ticket KWD ${ticketsTotal.toFixed(3)}.` });
  });

  await step('Check the food page: SKIP & PROCEED, the categories, items with prices and Add, and TIME REMAINING', async () => {
    await expect(page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i }).filter({ visible: true })).toBeVisible(); // SKIP & PROCEED.
    const categories = await foodCategories(page).allInnerTexts(); // Category names shown.
    for (const name of CATEGORIES) expect.soft(categories.map((text) => text.trim()), `Category ${name}`).toContain(name);
    const items = await foodItems(page).allInnerTexts(); // Items of the first category.
    testInfo.annotations.push({ type: 'first category items', description: items.map((text) => text.replace(/\s+/g, ' ').trim()).join(' | ') });
    expect(items.length, 'The first category should list items').toBeGreaterThan(0);
    for (const text of items) expect.soft(text, 'Each item should show a price and Add').toMatch(/KWD\s*\d+\.\d{3}[\s\S]*Add/i);
    await expect.soft(page.getByText(/time remaining/i).filter({ visible: true }).first(), 'TIME REMAINING should be shown').toBeVisible();
  });

  await step('Add the first item (choosing its options); check it shows "1 item added" and TOTAL rises by its price', async () => {
    itemName = (await item.locator('h4').innerText()).trim(); // e.g. "Combo 2".
    price = (await foodPrice(item)) ?? Number.NaN; // e.g. 2.
    testInfo.annotations.push({ type: 'food item', description: `${itemName}, KWD ${price.toFixed(3)}` });
    await addFood(page, item); // Add > options > quantity 1 > Done; the item shows "1 item added".
    await expectTotal(price, `After adding ${itemName}`);
  });

  await step('Change the quantity: Add the same item again; check it shows "2 items added" and TOTAL = ticket + 2 x the item', async () => {
    // Since the 8 Oct 2026 deployment the quantity is chosen in the options window; Add again puts one more in the cart.
    await addFood(page, item); // Add > options > quantity 1 > Done.
    await expect.poll(() => foodCount(item)).toBe(2);
    await expectTotal(price * 2, `With 2 x ${itemName}`);
  });

  await step('Look for a way to remove the item on the food page (noted when there is none)', async () => {
    // The food page has no "-" or remove since the 8 Oct 2026 deployment; that is noted, not failed. The food is
    // left out instead with Cancel and SKIP & PROCEED (last steps).
    const control = removeFoodControl(page, item);
    if (!notOnUat(await control.count() > 0, 'The food page has no way to take an added item out of the cart ("-" or remove).')) return;
    while (await foodCount(item) > 0 && await control.count()) await control.first().click(); // Take it all out.
    await expect.poll(() => foodCount(item), { message: 'The item should be out of the cart' }).toBe(0);
    await expectTotal(0, 'After removing the item');
    await addFood(page, item, 2); // Back to 2 for the next step.
  });

  await step('Proceed; check the payment page shows the food and total = ticket + food', async () => {
    const food = price * await foodCount(item); // e.g. 2 x KWD 2.000.
    await proceedFromFood(page); // Proceed; payment page.
    const summary = await readPaymentSummary(page); // Order summary.
    expect.soft(fils(summary.ticketsTotal), 'Payment page: ticket line').toBe(fils(ticketsTotal));
    expect.soft(fils(summary.food), `Payment page: Food Price should be KWD ${food.toFixed(3)}`).toBe(fils(food));
    expect(fils(summary.total), 'Payment page: Total amount to be paid = ticket + food').toBe(fils(ticketsTotal) + fils(food));
  });

  await step('Cancel, book the same show again and use SKIP & PROCEED; check the payment page has the ticket only', async () => {
    await cancelDuringBooking(page); // Cancel > Yes; the seat is released.
    await reopenSeatMap(page, testConfig.urls.home, show!); // Same show, General / Standard, seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    expect((await proceedWithFreeSeats(page, testConfig.urls.home, show!)).next, 'The food page should open again').toBe('food');
    await skipFood(page); // SKIP & PROCEED; payment page.
    const summary = await readPaymentSummary(page); // Order summary.
    expect.soft(fils(summary.food), 'Payment page: no food price').toBe(0);
    expect(fils(summary.total), 'Payment page: Total amount to be paid = the ticket only').toBe(fils(ticketsTotal));
  });

  await step('Cancel the booking (nothing is paid)', async () => {
    await cancelDuringBooking(page); // Cancel > Yes; the seat is released.
  });
});
