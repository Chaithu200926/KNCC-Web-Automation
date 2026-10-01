// WEB-49 Pay with an empty wallet - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Uses the second test account, whose wallet is empty and which has no other way to pay: books one seat for tomorrow
// up to the payment page, tries "Use your Wallet", and checks the payment is refused ("Insufficient wallet balance"),
// nothing is taken off the total and Proceed stays disabled. Then cancels; no booking is made.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, test accounts) and step() (step + screenshot).
import { fils, flatText, readKwdAfter } from '../pages/BookingChecks'; // Amount helpers.
import { // Booking steps (see pages/Booking.ts):
  cancelDuringBooking, chooseCategoryAndType, chooseShow, closeOpenMessage, openBookings, openMessage, proceedFromSeatMap,
  proceedToSeatMap, readPaymentSummary, selectAvailableSeats, signInAndReopenShow, skipFood, upcomingBookingIds,
} from '../pages/Booking';

test.describe.configure({ timeout: 300_000 }); // Up to 5 minutes (sign-in, booking and My Account on the slow UAT site).

test('WEB-49 Pay with an empty wallet', async ({ page, step, testConfig }, testInfo) => {
  const second = testConfig.secondAccount; // The second test account (empty wallet).
  test.skip(!second.username || !second.password || !second.pin, 'Set TEST2_USERNAME, TEST2_PASSWORD and TEST2_PIN (second test account) to run this test.');
  const proceed = page.getByRole('button', { name: 'Proceed', exact: true }).filter({ visible: true }).last(); // Proceed (= pay) on the payment page.
  const walletPanel = page.locator('.card-balance').filter({ visible: true }).first(); // The open "Use your Wallet" panel (Balance, Apply).
  let total = 0; // "Total amount to be paid" before trying the wallet.

  await step("Second test account: choose tomorrow's show and sign in", async () => {
    const show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, second, show); // Second account: email, password, OTP; same show again.
  });

  await step('Choose one General / Standard seat and go on to the payment page; check Proceed waits for a payment method', async () => {
    await chooseCategoryAndType(page); // General / Standard, 1 ticket.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    if (await proceedFromSeatMap(page) === 'food') await skipFood(page); // To the payment page.
    total = (await readPaymentSummary(page)).total ?? Number.NaN; // e.g. 3.5.
    expect(total, 'The payment page should show the total').toBeGreaterThan(0);
    await expect(proceed, 'Proceed should be disabled until a payment method is chosen').toBeDisabled();
  });

  await step('Open "Use your Wallet" and check the balance shown', async () => {
    await page.getByRole('button', { name: /use your wallet/i }).last().click(); // Open the wallet section.
    await expect(walletPanel).toBeVisible(); // Balance and Apply.
    let shown = ''; // e.g. "Balance Apply" (seen on UAT, 1 Oct 2026: no amount).
    await expect.soft.poll(async () => (shown = flatText(await walletPanel.innerText())), // Given 10 s for the amount to load.
      { message: 'The wallet panel should show the balance, KWD 0.000', timeout: 10_000 }).toMatch(/KWD\s*0\.000/);
    testInfo.annotations.push({ type: 'wallet panel', description: shown });
  });

  await step('Click Apply; check "Insufficient wallet balance", nothing is taken off the total and Proceed stays disabled', async () => {
    const answer = page.waitForResponse((response) => /\/clubcard\/apply/i.test(response.url()), { timeout: 30_000 }).catch(() => undefined); // The site's wallet request.
    await walletPanel.getByRole('button', { name: /apply/i }).click(); // Apply the wallet.
    const response = await answer;
    if (response) testInfo.annotations.push({ type: 'wallet apply answer', description: `HTTP ${response.status()}: ${(await response.text().catch(() => '')).slice(0, 200)}` });
    await expect(openMessage(page), 'The site should refuse the empty wallet').toContainText(/insufficient wallet balance/i); // The message.
    await closeOpenMessage(page); // OK.
    await expect(page.locator('body'), 'The wallet should not be applied').not.toContainText(/wallet applied/i);
    expect(fils(readKwdAfter(await page.locator('body').innerText(), 'Total amount to be paid')), 'Total amount to be paid should not change').toBe(fils(total));
    await expect(proceed, 'Proceed should stay disabled (nothing to pay with)').toBeDisabled();
  });

  await step('Cancel the booking; check My Account shows no booking and still no wallet balance', async () => {
    await cancelDuringBooking(page); // Cancel > Yes; the seat is released.
    await openBookings(page); // My Account > BOOKINGS.
    expect(await upcomingBookingIds(page), 'The second account should have no booking (it cannot pay)').toEqual([]);
    let balance: number | undefined; // e.g. 0 (seen on UAT, 1 Oct 2026: no amount shown).
    await expect.soft.poll(async () => (balance = readKwdAfter(await page.locator('body').innerText(), 'Wallet Balance')), // Given 15 s to load.
      { message: 'My Account should show Wallet Balance KWD 0.000', timeout: 15_000 }).toBe(0);
    testInfo.annotations.push({ type: 'wallet balance', description: balance === undefined ? '"Wallet Balance" shows no amount.' : `KWD ${balance.toFixed(3)}` });
  });
});
