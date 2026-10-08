// WEB-24 Seat category, seat type and ticket quantity - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Checks the seat categories and seat types (seats available, price), the ticket quantity (1 to 10) and its total,
// and that PROCEED opens the seat map. Uses the test account; no seat is held and nothing is paid.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect, notOnUat } from './fixtures'; // Shared setup: testConfig (site, test account) and step() (step + screenshot).
import { fils, flatText, readKwd } from '../pages/BookingChecks'; // KWD helpers.
import { appears } from '../pages/WebSite'; // Waits for a message.
import { // Booking steps (see pages/Booking.ts):
  chooseCategory, chooseSeatType, chooseShow, proceedToSeatMap, quantity, seatCategoryBoxes, seatTypeBoxes,
  signInAndReopenShow, ticketCount,
} from '../pages/Booking';

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (sign-in on the slow UAT site).
const MAX_TICKETS = 10; // Most tickets in one booking (PDF TC10).

test('WEB-24 Seat category, seat type and ticket quantity', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  test.skip(!username || !password || !pin, 'Set TEST_USERNAME, TEST_PASSWORD and TEST_PIN to run this test.');
  const box = quantity(page); // The quantity box (-, count, +, total).
  let price = 0; // Price of one General / Standard ticket in KWD.
  // Reads the count and total, and checks total = price x count.
  const expectTotal = async (count: number, when: string) => {
    await expect(box.count, `${when}: the quantity should be ${count}`).toHaveAttribute('placeholder', String(count));
    await expect.poll(async () => fils(readKwd(await box.total.innerText())), { message: `${when}: total should be ${count} x KWD ${price.toFixed(3)}` })
      .toBe(fils(price) * count);
  };

  await step("Choose tomorrow's show and sign in", async () => {
    const show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again ("Select Seat Category").
  });

  await step('Check the seat categories (Family, General) and that each lists seat types with seats available and a price', async () => {
    const categories = (await seatCategoryBoxes(page).allInnerTexts()).map((text) => flatText(text)); // e.g. ["Family", "General"].
    testInfo.annotations.push({ type: 'seat categories', description: categories.join(', ') });
    expect(categories, 'General should be offered').toContain('General');
    expect.soft(categories, 'Family should be offered').toContain('Family');
    for (const category of categories) { // Each category in turn:
      await chooseCategory(page, category); // choose it,
      for (const type of (await seatTypeBoxes(page).allInnerTexts()).map((text) => flatText(text))) { // and read its seat types.
        testInfo.annotations.push({ type: `${category} seat type`, description: type }); // e.g. "Standard 112 Available KWD 3.500".
        expect.soft(type, `${category}: "${type}" should show the seats available`).toMatch(/\d+\s+Available/i);
        expect.soft(type, `${category}: "${type}" should show a price`).toMatch(/KWD\s*\d+\.\d{3}/);
      }
    }
  });

  await step('Choose General / Standard and check the quantity starts at 1 with total = the seat type price', async () => {
    await chooseCategory(page, 'General'); // General.
    price = await chooseSeatType(page, 'Standard'); // Standard; its price (e.g. 3.5).
    expect(price, 'The Standard seat type should show a price').toBeGreaterThan(0);
    await expect(box.section).toContainText(/Standard\s+Ticket/i); // "Standard Ticket" (the space may be a non-breaking one).
    await expectTotal(1, 'At the start');
  });

  await step('Increase the quantity to 3 and back to 1; check the total each time', async () => {
    for (const count of [2, 3]) { // Up: 2, then 3.
      await box.plus.click();
      await expectTotal(count, `After + (${count})`);
    }
    for (const count of [2, 1]) { // Down: 2, then 1.
      await box.minus.click();
      await expectTotal(count, `After - (${count})`);
    }
    await box.minus.click(); // "-" at 1 ticket.
    await expectTotal(1, '"-" at 1 ticket (it cannot go below 1)');
  });

  await step(`Go up to ${MAX_TICKETS} tickets, try one more, and check it is blocked`, async () => {
    while (await ticketCount(page) < MAX_TICKETS) await box.plus.click(); // Up to the maximum.
    await expectTotal(MAX_TICKETS, `At ${MAX_TICKETS} tickets`);
    await box.plus.click(); // One more than allowed.
    await expectTotal(MAX_TICKETS, `"+" at ${MAX_TICKETS} tickets (the limit)`); // Still the maximum.
    const message = page.locator('.swal-overlay--show-modal .swal-modal, .swal2-popup, [role="alert"]').filter({ visible: true }); // Any message.
    const said = await appears(message.first(), 5_000); // Shown within 5 s?
    testInfo.annotations.push({ type: 'ticket limit', description: said ? `Message: ${flatText(await message.first().innerText())}` : `"+" at ${MAX_TICKETS} does nothing; no message is shown.` });
    notOnUat(said, `"+" at ${MAX_TICKETS} tickets is blocked without a message.`); // The block itself is checked above.
  });

  await step('Go back to 2 tickets, check the terms text, and check PROCEED opens the seat map', async () => {
    while (await ticketCount(page) > 2) await box.minus.click(); // Down to 2.
    await expectTotal(2, 'Back at 2 tickets');
    await expect(box.section.getByText(/By clicking Proceed, I agree to the/i).filter({ visible: true })).toBeVisible(); // Terms text.
    await expect(box.section.getByText(/terms & conditions/i).filter({ visible: true }).first()).toBeVisible(); // Its link.
    await proceedToSeatMap(page); // PROCEED; seat map (nothing is held until a seat is chosen and PROCEED is clicked).
    await expect(page.getByText(/choose your seat/i).first()).toBeVisible(); // "CHOOSE YOUR SEAT".
  });
});
