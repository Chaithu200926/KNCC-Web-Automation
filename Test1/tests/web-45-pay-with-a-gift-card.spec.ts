// WEB-45 Pay with a gift card - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// Books one ticket for tomorrow up to the payment page, checks an unknown gift card is refused, applies the UAT test gift
// card (TEST_GIFT_CARD), pays (any rest with the wallet), checks the confirmation page and HISTORY, then cancels the
// booking and notes where the money goes back (gift card or wallet).
// Seen on UAT (4 Oct 2026): "Add a Gift Card" opens a "Card number" box (#cardNumber, up to 16 digits) and Apply; the
// site asks api/giftcard/apply and an unknown card gets the pop-up "Gift card not found" (code 11001), with the total
// unchanged and Proceed disabled. The card number is private: it is hidden in screenshots and no trace is recorded.
// "Soft" checks (expect.soft) report a problem but let the test carry on (and still cancel the booking).
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures'; // Shared setup: testConfig (site, account, gift card) and step() (step + screenshot).
import { openAccountTab, openMyAccount } from '../pages/Account'; // My Account and its tabs.
import { fils, flatText, readKwdAfter, readWalletBalance } from '../pages/BookingChecks'; // Amount helpers.
import { // Booking steps (see pages/Booking.ts):
  cancelBookingInMyProfile, cancelDuringBooking, chooseCategoryAndType, chooseShow, notePaidBooking, openBookings,
  proceedToSeatMap, proceedWithFreeSeats, readConfirmation, readPaymentSummary, selectAvailableSeats,
  signInAndReopenShow, skipFood, type Show,
} from '../pages/Booking';
import { appears } from '../pages/WebSite'; // Waits for a pop-up.

test.use({ trace: 'off' }); // Traces record typed text, which here would include the gift card number.
test.describe.configure({ timeout: 360_000 }); // Up to 6 minutes (booking, payment, history and cancellation).
const UNKNOWN_CARD = '900000000001'; // A card number UAT does not know (answer seen 4 Oct 2026: "Gift card not found").
const kwd = (amount: number | undefined) => `KWD ${(amount ?? Number.NaN).toFixed(3)}`; // 1.75 → "KWD 1.750".

/** The open message pop-up (SweetAlert), e.g. "Gift card not found". */
const popup = (page: Page) => page.locator('.swal-overlay--show-modal .swal-modal, .swal2-popup').filter({ visible: true }).first();

/** "Total amount to be paid" on the payment page, in KWD. */
const amountToPay = async (page: Page) => readKwdAfter(await page.locator('body').innerText(), 'Total amount to be paid');

/**
 * Types a card number into the open "Add a Gift Card" box (hidden in screenshots), clicks Apply and returns the
 * site's answer (api/giftcard/apply: result / msg) and the pop-up text, if any (the pop-up is closed with OK).
 */
async function applyGiftCard(page: Page, cardNumber: string) {
  const box = page.locator('#cardNumber').filter({ visible: true }).first(); // "Card number".
  await box.evaluate((input) => { (input as HTMLElement).style.setProperty('color', 'transparent', 'important'); }); // Hide the number.
  await box.fill(cardNumber);
  const kept = (await box.inputValue()) === cardNumber; // Seen 4 Oct 2026: the box keeps digits only ("Q1S5GJHV2K" became "152").
  const answer = page.waitForResponse((r) => /\/giftcard\/apply/i.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button', { name: /^apply$/i }).filter({ visible: true }).first().click(); // Apply.
  const body = (await (await answer).json().catch(() => ({}))) as { result?: string; msg?: string; code?: number; output?: unknown };
  const message = await appears(popup(page), 5_000) ? flatText(await popup(page).innerText()).replace(/\s*OK$/i, '') : '';
  if (message) await popup(page).getByRole('button').first().click(); // OK.
  return { result: body.result ?? '', msg: body.msg ?? '', code: body.code, output: body.output, message, kept };
}

// If the test stops on the payment page (e.g. the gift card is refused), cancel there so the seat is not left held.
// (A booking that was already paid is cancelled by the clean-up in tests/fixtures.ts.)
test.afterEach(async ({ page }) => {
  if (/\/payment\//.test(page.url())) await cancelDuringBooking(page).catch(() => undefined);
});

test('WEB-45 Pay with a gift card', async ({ page, step, testConfig }, testInfo) => {
  const { username, password, pin } = testConfig.credentials;
  const card = testConfig.payment.giftCard;
  test.skip(!username || !password || !pin || !card, 'Set TEST_USERNAME, TEST_PASSWORD, TEST_PIN and TEST_GIFT_CARD to run this test.');
  const proceed = page.getByRole('button', { name: 'Proceed', exact: true }).last(); // Proceed (= pay).
  const hideCard = (text: string) => text.split(card).join('****'); // Never write the card number into the report.
  let show: Show; // The show chosen.
  let total = 0; // "Total amount to be paid" before the gift card.
  let booking = { bookingId: '', dateTime: '', grandTotal: undefined as number | undefined }; // The paid booking.

  await step("Book one General / Standard seat for tomorrow up to the payment page", async () => {
    show = await chooseShow(page, testConfig.urls.home, 'tomorrow'); // A show tomorrow.
    await signInAndReopenShow(page, testConfig.credentials, show); // Email, password, OTP; same show again.
    await chooseCategoryAndType(page); // General / Standard, 1 ticket.
    await proceedToSeatMap(page); // Seat map.
    await selectAvailableSeats(page, 1); // One free seat.
    const { next } = await proceedWithFreeSeats(page, testConfig.urls.home, show); // PROCEED (other seats if one is held).
    if (next === 'food') await skipFood(page); // To the payment page.
    total = (await readPaymentSummary(page)).total ?? Number.NaN; // e.g. 3.5.
    expect(total, 'The payment page should show the total').toBeGreaterThan(0);
  });

  await step('Open "Add a Gift Card", try an unknown card and check it is refused with a clear message', async () => {
    await page.getByRole('button', { name: /add a gift card/i }).last().click(); // Open the gift card section.
    await expect(page.locator('#cardNumber').filter({ visible: true }).first(), 'A "Card number" box should open').toBeVisible({ timeout: 15_000 });
    const unknown = await applyGiftCard(page, UNKNOWN_CARD);
    testInfo.annotations.push({ type: 'unknown gift card', description: `Answer: ${unknown.result} ${unknown.code ?? ''} "${unknown.msg}"; pop-up: "${unknown.message || 'none'}".` });
    expect(unknown.result, 'An unknown gift card must not be accepted').not.toMatch(/success/i);
    expect.soft(unknown.message, 'The site should say why the card was refused').toMatch(/not found|invalid|expired|not valid/i);
    expect(fils(await amountToPay(page)), 'Total amount to be paid should not change').toBe(fils(total));
    await expect(proceed, 'Proceed should stay disabled').toBeDisabled();
  });

  await step('Apply the test gift card and check its amount is taken off the total', async () => {
    const applied = await applyGiftCard(page, card);
    expect.soft(applied.kept, 'The "Card number" box should keep the whole gift card code (it drops letters, so codes with letters cannot be entered)').toBe(true);
    testInfo.annotations.push({ type: 'test gift card', description: hideCard(`Answer: ${applied.result} ${applied.code ?? ''} "${applied.msg}"; pop-up: "${applied.message || 'none'}"; details: ${JSON.stringify(applied.output ?? null).slice(0, 300)}`) });
    expect(applied.result, `The test gift card should be accepted (the site said: "${applied.msg || applied.message}"; on 4 Oct 2026 UAT answered "Gift card not found" for both cards provided)`)
      .toMatch(/success/i);
    let left: number | undefined; // "Total amount to be paid" after the gift card.
    await expect.poll(async () => (left = await amountToPay(page)), { message: 'The gift card should reduce the total', timeout: 15_000 })
      .toBeLessThan(total);
    testInfo.annotations.push({ type: 'gift card used', description: `${kwd(total - (left ?? total))} paid by the gift card; ${kwd(left)} left to pay.` });
  });

  await step('Pay (the wallet pays any rest) and check the confirmation page shows the gift card payment', async () => {
    if (await proceed.isDisabled()) { // The gift card covers only part: pay the rest with the wallet.
      await page.getByRole('button', { name: /use your wallet/i }).last().click(); // Open the wallet section.
      await page.locator('.card-balance').filter({ visible: true }).first().getByRole('button', { name: /^apply$/i }).click(); // Apply the wallet.
      await expect(page.locator('body')).toContainText(/wallet applied/i, { timeout: 15_000 });
    }
    await expect(proceed, 'Proceed should be enabled once the amount is covered').toBeEnabled({ timeout: 15_000 });
    await proceed.click(); // Pay.
    await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 60_000 }); // Confirmation page.
    booking = await readConfirmation(page); // Booking ID, date & time, Grand Total.
    notePaidBooking(page, booking.bookingId); // Cancelled afterwards even if a check fails.
    testInfo.annotations.push({ type: 'paid booking', description: `${booking.bookingId}, ${booking.dateTime}, Grand Total ${kwd(booking.grandTotal)}` });
    expect.soft(fils(booking.grandTotal), 'Grand Total should be the ticket price').toBe(fils(total));
    expect.soft(flatText(await page.locator('body').innerText()), 'Payment Mode should mention the gift card').toMatch(/Payment Mode\s*[^\n]*gift/i);
  });

  await step('Check My Account > HISTORY shows the booking paid with the gift card', async () => {
    await openMyAccount(page); // My Account.
    await openAccountTab(page, 'HISTORY'); // HISTORY tab.
    const historyCard = page.locator('.movie_section').filter({ visible: true }).filter({ hasText: booking.bookingId }).first(); // This booking.
    await expect(historyCard, `HISTORY should list booking ${booking.bookingId}`).toBeVisible({ timeout: 30_000 });
    await historyCard.getByText(/^view details$/i).click(); // View Details.
    const details = page.locator('div').filter({ visible: true }).filter({ has: page.getByText(/^close details$/i) })
      .filter({ hasText: /grand total/i }).filter({ hasText: booking.bookingId }).last(); // The expanded block.
    const text = flatText(await details.innerText());
    testInfo.annotations.push({ type: 'history details', description: hideCard(text) });
    expect.soft(text, 'HISTORY should show the gift card payment').toMatch(/gift/i);
  });

  await step('Cancel the booking and note where the money goes back (gift card or wallet)', async () => {
    await openBookings(page); // My Account > BOOKINGS.
    const walletBefore = await readWalletBalance(page); // Balance before cancelling.
    await cancelBookingInMyProfile(page, booking.bookingId, show.title); // Cancel Booking > Yes, I'm sure.
    await openBookings(page); // Back to My Account.
    await page.waitForTimeout(5_000); // Give the refund a moment.
    await page.reload({ waitUntil: 'domcontentloaded' });
    const refund = (fils(await readWalletBalance(page)) - fils(walletBefore)) / 1000; // Credited to the wallet.
    testInfo.annotations.push({ type: 'refund', description: `${kwd(refund)} credited to the wallet after cancelling a ${kwd(booking.grandTotal)} booking (the rest, if any, should go back to the gift card).` });
  });
});
