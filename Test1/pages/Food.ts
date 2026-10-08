// Food page steps shared by the website food test cases (WEB-26, WEB-28): categories, items and prices, the options
// window of an item, the cart TOTAL, and leaving the page with Proceed.
// Seen on UAT: food is offered for today's shows only; Add opens an options window (e.g. popcorn flavour and drink, a
// quantity starting at 0, Done enabled once an option is chosen). Since the 8 Oct 2026 deployment the item keeps its
// Add button and shows "n item(s) added", and the page has no "-" or remove (before: "- n +", "-" to 0 removed it).
// The page also holds a hidden copy of everything for phones, so only visible elements are used.
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and types.
import { readKwd } from './BookingChecks'; // Reads "KWD 2.000" as 2.

/** The food categories (Combos, Snacks, Popcorn, Beverages, Coffee & Tea, Chocolates, Healthy). */
export const foodCategories = (page: Page) => page.locator('.food-category-preview').filter({ visible: true });

/** The food items shown for the chosen category (picture, name, description, price, Add and "n item(s) added"). */
export const foodItems = (page: Page) => page.locator('.food-item-preview').filter({ visible: true });

/** The options window of an item (choices, Selected Quantity, Total Prices, Cancel / Done). */
export const foodOptions = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.locator('.food-modal') });

/** Waits for the food page (its items) and returns the running TOTAL in KWD. */
export async function openedFoodPage(page: Page) {
  await expect(foodItems(page).first()).toBeVisible({ timeout: 30_000 }); // Items listed.
  let total: number | undefined; // "TOTAL" is shown a moment before its amount.
  await expect.poll(async () => (total = await foodPageTotal(page)), { message: 'The food page should show the TOTAL amount', timeout: 20_000 }).toBeDefined();
  return total;
}

/** The running TOTAL in the booking bar (tickets + food) in KWD, e.g. 5.5. */
export async function foodPageTotal(page: Page) {
  return readKwd(await page.locator('.booked-movie-total').filter({ visible: true }).first().innerText()); // "TOTAL KWD 5.500".
}

/** The price of a food item in KWD, e.g. 2. */
export async function foodPrice(item: Locator) {
  return readKwd(await item.locator('.food-price').innerText()); // "KWD 2.000".
}

/** How many of an item are in the cart: "2 items added" under its Add button (0 while nothing is added). */
export async function foodCount(item: Locator) {
  const added = item.locator('.food-added-count'); // e.g. "1 item added" (since the 8 Oct 2026 deployment).
  if (await added.count()) return Number((await added.innerText()).match(/\d+/)?.[0] ?? 0);
  const count = item.locator('#ticket-count'); // The older "- n +" box (before 8 Oct 2026).
  return await count.count() ? Number(await count.getAttribute('placeholder')) : 0;
}

/**
 * Clicks Add on an item. If the options window opens, chooses the first choice of each option (e.g. Salt, Pepsi),
 * sets the quantity (1 by default) and clicks Done. Waits until the item shows that many more in the cart.
 * Add always opens a new window starting at 0, so a second Add puts more of the item in the cart.
 */
export async function addFood(page: Page, item: Locator, quantity = 1) {
  const before = await foodCount(item); // Already in the cart.
  await item.getByRole('button', { name: /^add$/i }).click(); // Add.
  const options = foodOptions(page);
  await expect.poll(async () => await options.isVisible() || await foodCount(item) > before, { timeout: 15_000 }).toBe(true); // Window or added.
  if (await options.isVisible()) { // The item has options:
    const groups = options.locator('.selected-food'); // One group per option (e.g. popcorn flavour, drink).
    for (const group of await groups.all()) await group.locator('.pop-corn-imgs').first().click(); // First choice of each.
    if (!await groups.count()) await options.locator('.pop-corn-imgs').first().click(); // A single list of choices.
    const quantityBox = options.locator('#ticket-count'); // Selected Quantity (starts at 0).
    const plus = options.locator('.counter-button button').last(); // "+".
    while (Number(await quantityBox.getAttribute('placeholder')) < quantity) await plus.click(); // Up to the quantity.
    await expect(quantityBox).toHaveAttribute('placeholder', String(quantity));
    await options.locator('.done-btn').click(); // Done.
    await expect(options).toBeHidden(); // The window closes.
  }
  await expect.poll(() => foodCount(item), { message: `The item should be in the cart ${before + quantity} time(s)` }).toBe(before + quantity);
}

/** The way to take an item out of the cart, if the food page has one ("-" or a remove button). */
export const removeFoodControl = (page: Page, item: Locator) => item.locator('.counter-button button').first()
  .or(page.locator('.booked-info-fixed').getByRole('button', { name: /remove|delete/i })).filter({ visible: true });

/** Clicks Proceed on the food page and waits for the payment page. */
export async function proceedFromFood(page: Page) {
  await page.locator('.booked-info-fixed .proceed-btn').filter({ visible: true }).first().click(); // Proceed.
  await expect(page).toHaveURL(/\/payment\//, { timeout: 30_000 }); // Payment page.
}
