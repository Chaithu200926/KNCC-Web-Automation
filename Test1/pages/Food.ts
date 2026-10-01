// Food page steps shared by the website food test cases (WEB-26, WEB-28): categories, items and prices, the options
// window of an item, the cart TOTAL, and leaving the page with Proceed.
// Seen on UAT (1 Oct 2026): food is offered for today's shows only; Add opens an options window (e.g. popcorn flavour
// and drink, a quantity starting at 0, Done enabled once an option is chosen); after Done the item shows "- n +"
// instead of Add, and "-" down to 0 takes it out again (Add comes back). The page also holds a hidden copy of
// everything for phones, so only visible elements are used.
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and types.
import { readKwd } from './BookingChecks'; // Reads "KWD 2.000" as 2.

/** The food categories (Combos, Snacks, Popcorn, Beverages, Coffee & Tea, Chocolates, Healthy). */
export const foodCategories = (page: Page) => page.locator('.food-category-preview').filter({ visible: true });

/** The food items shown for the chosen category (picture, name, description, price, and Add or "- n +"). */
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

/** How many of an item are in the cart (0 while it still shows Add). */
export async function foodCount(item: Locator) {
  const count = item.locator('#ticket-count'); // The box between - and + (only there once added).
  if (!await count.count()) return 0; // Still shows Add.
  return Number(await count.getAttribute('placeholder')); // The number is shown as the box's placeholder.
}

/** The "-" and "+" buttons of an item already in the cart. */
export const foodButtons = (item: Locator) => ({
  minus: item.locator('.counter-button button').first(), // "-": one less (at 1 it takes the item out).
  plus: item.locator('.counter-button button').last(), // "+": one more.
});

/**
 * Clicks Add on an item. If the options window opens, chooses the first choice of each option (e.g. Salt, Pepsi),
 * makes sure the quantity is 1 and clicks Done. Waits until the item shows 1 in the cart.
 */
export async function addFood(page: Page, item: Locator) {
  await item.getByRole('button', { name: /^add$/i }).click(); // Add.
  const options = foodOptions(page);
  await expect.poll(async () => await options.isVisible() || await foodCount(item) > 0, { timeout: 15_000 }).toBe(true); // Window or added.
  if (await options.isVisible()) { // The item has options:
    const groups = options.locator('.selected-food'); // One group per option (e.g. popcorn flavour, drink).
    for (const group of await groups.all()) await group.locator('.pop-corn-imgs').first().click(); // First choice of each.
    if (!await groups.count()) await options.locator('.pop-corn-imgs').first().click(); // A single list of choices.
    const quantityBox = options.locator('#ticket-count'); // Selected Quantity.
    if (await quantityBox.getAttribute('placeholder') === '0') await options.locator('.counter-button button').last().click(); // Make it 1.
    await expect(quantityBox).toHaveAttribute('placeholder', '1');
    await options.locator('.done-btn').click(); // Done.
    await expect(options).toBeHidden(); // The window closes.
  }
  await expect.poll(() => foodCount(item), { message: 'The item should be in the cart once' }).toBe(1);
}

/** Clicks Proceed on the food page and waits for the payment page. */
export async function proceedFromFood(page: Page) {
  await page.locator('.booked-info-fixed .proceed-btn').filter({ visible: true }).first().click(); // Proceed.
  await expect(page).toHaveURL(/\/payment\//, { timeout: 30_000 }); // Payment page.
}
