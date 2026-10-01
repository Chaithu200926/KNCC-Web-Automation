// Booking steps shared by the website booking test cases (WEB-23..WEB-48): choose a show, sign in when asked,
// choose seat category / type / quantity / seats, go on to the food or payment page, pay with the wallet,
// cancel during booking, and cancel a confirmed booking in My Profile.
// The steps follow the proven wallet booking test (WEB-03, web-03-cinema-booking-with-wallet.spec.ts).
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and types.
import { completeSignIn, signInDialog, type Credentials } from './Account'; // Sign-in with email, password and OTP.
import { flatText, readKwd, readKwdAfter, readSummarySeat, titlePattern } from './BookingChecks'; // Text helpers.
import { appears, kuwaitMinutesNow, minutesOf, openHome } from './WebSite'; // Page helpers.

/** What was chosen for a booking (filled in step by step). */
export interface Show {
  movieTitle: string; // Title from the movie URL, e.g. "wake up".
  title: RegExp; // Flexible pattern of that title.
  language: string; // Language from the movie URL, e.g. "English".
  href: string; // Movie page link.
  day: string; // Day of the month on the chosen date tab, e.g. "01".
  time: string; // Chosen show time, e.g. "20:35".
}

/** The movie links on the homepage banner (one per movie). */
export async function bannerMovieLinks(page: Page) {
  const links = await page.locator('.banner-item a[href*="/moviesessions/"]').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
  return [...new Set(links.filter(Boolean))]; // Without repeats (the carousel repeats items).
}

/** The date tabs and the show time buttons on a movie page. */
export const dateTabs = (page: Page) => page.getByRole('tab');

/**
 * One date tab, by a line of its text: the day of the month (e.g. "01") or the weekday (e.g. "Mon").
 * Each tab shows "Today" / "Mon" and "01" as two separate lines, so the line itself is matched
 * (the tab's whole text reads "Today01", where a word-boundary pattern would not find "01").
 */
export const dateTab = (page: Page, line: string) => dateTabs(page).filter({ has: page.getByText(new RegExp(`^${line}$`, 'i')) }).first();
export const showTimes = (page: Page) => page.locator('.time-box:visible');

/**
 * Opens a homepage movie that has a suitable show and clicks it:
 * - `date: 'tomorrow'` (default): a daytime / evening show tomorrow;
 * - `date: 'today'`: a show today starting at least `minHoursAhead` hours from now (default 3);
 * - `date: 'monday'` / `'tuesday'`: a show on the next Monday / Tuesday tab (Monday is the half-price day).
 * Returns what was chosen. The sign-in dialog opens next if the user is signed out.
 */
export async function chooseShow(page: Page, baseUrl: string, date: ShowDate = 'tomorrow', minHoursAhead = 3): Promise<Show> {
  await openHome(page, baseUrl); // Load the homepage.
  for (const href of await bannerMovieLinks(page)) { // Try each banner movie until one has a suitable show.
    const show = await chooseShowOfMovie(page, baseUrl, href, date, minHoursAhead); // This movie's show, if any.
    if (show) return show;
  }
  throw new Error(`No homepage movie has a suitable ${date} show.`);
}

/** Which date to book: today, tomorrow, or the next Monday (half-price day) / Tuesday (normal price). */
export type ShowDate = 'today' | 'tomorrow' | 'monday' | 'tuesday';

/**
 * Opens one movie page (`href`) and clicks its first suitable show on `date` at Cinescape 360 (see chooseShow).
 * Returns what was chosen, or undefined when the movie has no suitable show that day.
 */
export async function chooseShowOfMovie(page: Page, baseUrl: string, href: string, date: ShowDate, minHoursAhead = 3): Promise<Show | undefined> {
  await page.goto(new URL(href, baseUrl).toString(), { waitUntil: 'commit' }); // Open the movie page.
  await expect(dateTabs(page).nth(1)).toBeVisible({ timeout: 60_000 }); // Wait for the date tabs.
  await page.locator('#cinema0000000001, .cinemacarousal').filter({ hasText: /Cinescape 360/i }).first().click(); // Cinescape 360.
  let tab: Locator; // The date tab to use.
  if (date === 'today') {
    if (!/today/i.test(await dateTabs(page).first().innerText())) return undefined; // No show today for this movie.
    tab = dateTabs(page).first();
  } else if (date === 'tomorrow') {
    tab = dateTabs(page).nth(/today/i.test(await dateTabs(page).first().innerText()) ? 1 : 0); // Tab after "Today".
  } else {
    tab = dateTab(page, date.slice(0, 3)); // First Monday / Tuesday tab ("Mon" over "05").
    if (!await tab.count()) return undefined; // Not in the list.
  }
  await tab.click(); // Choose the date.
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(1_500); // Let the show times redraw.
  const times = (await showTimes(page).allInnerTexts()).map((text) => text.trim()); // e.g. ["12:20", "20:35", "00:40"].
  const earliest = date === 'today' ? kuwaitMinutesNow() + minHoursAhead * 60 : 6 * 60; // Today: far enough ahead; else after 06:00.
  const time = times.find((t) => minutesOf(t) >= Math.max(earliest, 6 * 60)); // First suitable show (not after midnight).
  if (!time) return undefined; // None that day.
  const url = new URL(page.url()); // Movie page address.
  const movieTitle = decodeURIComponent(url.pathname.split('/')[2] ?? '').replace(/[-()]+/g, ' ').replace(/\s+/g, ' ').trim();
  const day = (await tab.innerText()).match(/\d{1,2}/)?.[0] ?? ''; // Day of the month on the tab.
  await showTimes(page).filter({ hasText: time }).first().evaluate((element) => (element as HTMLElement).click()); // Click the show.
  return { movieTitle, title: titlePattern(movieTitle), language: url.searchParams.get('language') ?? '', href, day, time };
}

/**
 * After clicking a show while signed out: signs in (email, password, OTP), then chooses the same date and show again
 * (signing in reloads the movie page) and waits for "Select Seat Category".
 */
export async function signInAndReopenShow(page: Page, account: Credentials, show: Show) {
  await completeSignIn(page, account); // Email + password, then the email OTP.
  const tab = dateTab(page, show.day); // Same date tab.
  await tab.click(); // Choose it again.
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await openShowTime(page, show.time); // Same show again; "Select Seat Category".
}

/**
 * Signed in: clicks a show time on the chosen date and waits for "Select Seat Category". The show times are redrawn
 * for a moment after a date tab is clicked, and a click during that is lost, so it clicks again until the step opens.
 */
export async function openShowTime(page: Page, time: string) {
  const category = page.getByText(/Select Seat Category/i).first(); // The seat category step.
  await expect(async () => {
    await showTimes(page).filter({ hasText: time }).first().click({ force: true }); // The show time.
    await expect(category).toBeVisible({ timeout: 5_000 }); // Opened?
  }, `Show ${time} should open "Select Seat Category"`).toPass({ timeout: 60_000 });
}

/** The seat category boxes (e.g. Family, General) under "Select Seat Category". */
export const seatCategoryBoxes = (page: Page) => page.locator('#seat-category-section .seat-category-box');

/** The seat type boxes (e.g. "Standard / 112 Available / KWD 3.500") under "Select Seat Type". */
export const seatTypeBoxes = (page: Page) => page.locator('#seat-type .seat-category-box');

/**
 * The seat quantity box: minus button, count, plus button and the running total.
 * The count is shown as the placeholder of the box between - and + (the box itself stays empty); it runs from 1 to 10.
 */
export const quantity = (page: Page) => {
  const section = page.locator('.seat-quantity-section'); // "Select Ticket Quantity".
  return {
    section,
    minus: section.locator('.counter-button button').first(), // "-" button.
    plus: section.locator('.counter-button button').last(), // "+" button.
    count: section.locator('#ticket-count'), // Box showing the number of tickets (as its placeholder).
    total: section.locator('.kd-total'), // Total, e.g. "KWD 7.000".
  };
};

/** The number of tickets shown in the quantity box, e.g. 2. */
export async function ticketCount(page: Page) {
  return Number(await quantity(page).count.getAttribute('placeholder')); // e.g. "2" → 2.
}

/** Sets the number of tickets with the + and - buttons (1 to 10). */
export async function setTicketCount(page: Page, wanted: number) {
  const box = quantity(page);
  while (await ticketCount(page) < wanted) await box.plus.click(); // Up, one ticket at a time.
  while (await ticketCount(page) > wanted) await box.minus.click(); // Down, one ticket at a time.
  await expect(box.count).toHaveAttribute('placeholder', String(wanted)); // Now shows the wanted number.
}

/** Chooses a seat category (e.g. General) and waits for its seat types. */
export async function chooseCategory(page: Page, category = 'General') {
  const box = seatCategoryBoxes(page).filter({ hasText: new RegExp(`^${category}$`) }).first(); // Category box.
  await box.click(); // Choose it.
  await expect(box).toHaveClass(/active/); // Marked as chosen.
  await expect(seatTypeBoxes(page).first()).toBeVisible({ timeout: 15_000 }); // Its seat types are shown.
}

/** Chooses a seat type (e.g. Standard); waits for the quantity box and returns the seat type's price in KWD. */
export async function chooseSeatType(page: Page, seatType = 'Standard') {
  const type = seatTypeBoxes(page).filter({ hasText: new RegExp(`^${seatType}`) }).first(); // Seat type box.
  await expect(type).toBeVisible({ timeout: 15_000 });
  await type.click(); // Choose it.
  await expect(quantity(page).section).toBeVisible(); // Quantity box appears (count 1).
  return readKwd(await type.innerText()) ?? Number.NaN; // Price shown on the seat type, e.g. 3.5.
}

/** Chooses the seat category and seat type (default General / Standard); returns the seat type's price in KWD. */
export async function chooseCategoryAndType(page: Page, category = 'General', seatType = 'Standard') {
  await chooseCategory(page, category); // Seat category.
  return chooseSeatType(page, seatType); // Seat type and its price.
}

/** Clicks PROCEED under the quantity box and waits for the seat map. */
export async function proceedToSeatMap(page: Page) {
  await quantity(page).section.getByRole('button', { name: 'PROCEED', exact: true }).click(); // PROCEED.
  await expect(page).toHaveURL(/\/seatlayout/, { timeout: 30_000 }); // Seat map page.
  await expect(page.locator('.seat[id]').first()).toBeVisible({ timeout: 30_000 }); // Seats drawn.
}

// How the seat map draws seats (seen on UAT, 1 Oct 2026):
// - a free seat shows its number and has two pictures: light grey, and a red one that is shown once it is selected;
// - a selected seat also gets the class "active";
// - an unavailable seat (sold, held, or of another seat category, e.g. Family seats when booking General) keeps its id
//   but has a single dark grey picture and no number;
// - empty places in a row are seats with id="".
// The legend uses other (larger) pictures, so seats are recognised by this structure, not by comparing pictures.

/** The state of a seat on the map. */
export type SeatState = 'available' | 'unavailable' | 'selected' | 'other';

/** A seat on the map by its id (ids contain "|", so an attribute selector is used). */
export const seat = (page: Page, id: string) => page.locator(`.seat[id="${id}"]`);

/** The state of every seat on the map, by seat id (in map order). */
export async function seatStates(page: Page): Promise<Record<string, SeatState>> {
  return page.locator('.seat[id]:not([id=""])').evaluateAll((seats) => Object.fromEntries(seats.map((element) => {
    const pictures = element.querySelectorAll('img').length; // 2 = free seat, 1 = unavailable seat.
    const state = element.classList.contains('active') ? 'selected' : pictures === 2 ? 'available' : pictures === 1 ? 'unavailable' : 'other';
    return [element.id, state];
  })));
}

/** Ids of the seats in one state, in map order. */
export async function seatIds(page: Page, state: SeatState) {
  return Object.entries(await seatStates(page)).filter(([, seatNow]) => seatNow === state).map(([id]) => id);
}

/** The state of one seat ('other' if the seat is not on the map). */
export async function seatState(page: Page, id: string): Promise<SeatState> {
  return (await seatStates(page))[id] ?? 'other';
}

/** A seat's name as on the ticket, e.g. "K18": the row letter at the start of its row + the seat number. */
export async function seatLabel(page: Page, id: string) {
  const row = await seat(page, id).locator('xpath=ancestor::tr[1]').locator('.row-name').innerText({ timeout: 10_000 }); // e.g. "K".
  const number = (await seat(page, id).locator('img').first().getAttribute('alt', { timeout: 10_000 })) ?? ''; // e.g. "18" (kept even when unavailable).
  return `${row.trim()}${number.trim()}`;
}

/**
 * Clicks a seat as a person would: on its middle, where its number sits on top of the picture
 * (Playwright first scrolls it clear of the fixed black header).
 */
export async function clickSeat(page: Page, id: string) {
  await seat(page, id).click();
}

/**
 * Selects `count` available seats, picked at random, and returns their ids. Random, not front-first: an unpaid booking
 * left by an earlier run can hold seats for over 30 minutes on UAT, and the same account still sees them as free.
 */
export async function selectAvailableSeats(page: Page, count: number) {
  const free = await seatIds(page, 'available'); // Free seats, in map order.
  for (let i = free.length - 1; i > 0; i -= 1) { // Shuffle them.
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  const chosen: string[] = [];
  for (const id of free) { // Free seats, in random order.
    if (chosen.length === count) break;
    await clickSeat(page, id); // Click the seat.
    if (await seatState(page, id) === 'selected') chosen.push(id); // Now selected.
  }
  expect(chosen.length, `${count} available seat(s) should be selected`).toBe(count);
  return chosen;
}

/** The site's message pop-up while it is open (e.g. "Please select only 2 seat(s)"); closed ones stay in the page, hidden. */
export const openMessage = (page: Page) => page.locator('.swal-overlay--show-modal .swal-modal');

/** Closes the open message pop-up with OK. */
export async function closeOpenMessage(page: Page) {
  await openMessage(page).getByRole('button', { name: /^ok$/i }).click(); // OK.
  await expect(openMessage(page)).toHaveCount(0); // Closed.
}

/**
 * Signed in: opens the same show again (movie page, Cinescape 360, date, show time), chooses General / Standard
 * and goes to its seat map. Used to see whether seats held earlier are free again.
 */
export async function reopenSeatMap(page: Page, baseUrl: string, show: Show) {
  await page.goto(new URL(show.href, baseUrl).toString(), { waitUntil: 'commit' }); // Movie page.
  await expect(dateTabs(page).nth(1)).toBeVisible({ timeout: 60_000 }); // Date tabs.
  await page.locator('#cinema0000000001, .cinemacarousal').filter({ hasText: /Cinescape 360/i }).first().click(); // Cinescape 360.
  const tab = dateTab(page, show.day); // Same date tab.
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await openShowTime(page, show.time); // Same show time; "Select Seat Category".
  await chooseCategoryAndType(page); // General / Standard.
  await proceedToSeatMap(page); // Seat map.
}

/**
 * Signed out: opens a known show (movie page, Cinescape 360, date, show time), so the sign-in dialog opens.
 * Used for a second user who books the same show (follow with signInAndReopenShow).
 */
export async function clickShowSignedOut(page: Page, baseUrl: string, show: Show) {
  await page.goto(new URL(show.href, baseUrl).toString(), { waitUntil: 'commit' }); // Movie page.
  await expect(dateTabs(page).nth(1)).toBeVisible({ timeout: 60_000 }); // Date tabs.
  await page.locator('#cinema0000000001, .cinemacarousal').filter({ hasText: /Cinescape 360/i }).first().click(); // Cinescape 360.
  const tab = dateTab(page, show.day); // The show's date.
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(1_500); // Let the show times redraw.
  await showTimes(page).filter({ hasText: show.time }).first().evaluate((element) => (element as HTMLElement).click()); // The show time.
  await expect(signInDialog(page)).toBeVisible({ timeout: 30_000 }); // The sign-in dialog opens.
}

/** Clicks PROCEED under the seat map; returns where the site went next ('food' page or 'payment' page). */
export async function proceedFromSeatMap(page: Page): Promise<'food' | 'payment'> {
  const next = await tryProceedFromSeatMap(page); // PROCEED: food page, payment page, or refused.
  expect(next, `The site refused the chosen seat(s) (now on ${new URL(page.url()).pathname}). An unpaid booking abandoned `
    + 'earlier may still hold them: on UAT such holds outlast the 4-minute timer, and the same account sees them as free.').not.toBe('refused');
  return next as 'food' | 'payment';
}

/**
 * "Bookings Found!": shown after PROCEED when the account already has a booking for the same show (the booking, then
 * "Go to Bookings" / "Continue booking").
 */
export const bookingsFoundDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: /bookings found/i }).last();

/**
 * Clicks PROCEED under the seat map and reports what happened: 'food' or 'payment' (the seats are now reserved), or
 * 'refused'. Seen on UAT (1 Oct 2026) when a seat is held by someone else: the reservation answer is empty and the
 * site shows a blank /login page with no message. (The seat map itself may still show such a seat as Available.)
 */
export async function tryProceedFromSeatMap(page: Page): Promise<'food' | 'payment' | 'refused'> {
  await page.getByRole('button', { name: 'PROCEED', exact: true }).last().click(); // PROCEED.
  const bookingsFound = bookingsFoundDialog(page); // Shown when the account already has a booking for this show.
  await expect.poll(async () => !/\/seatlayout/.test(page.url()) || await bookingsFound.isVisible(), { timeout: 30_000 }).toBe(true);
  if (await bookingsFound.isVisible()) await bookingsFound.getByRole('button', { name: /continue booking/i }).click(); // Book again anyway.
  await expect(page).not.toHaveURL(/\/seatlayout/, { timeout: 30_000 }); // The site leaves the seat map either way.
  if (/\/food\//.test(page.url())) return 'food';
  return /\/payment\//.test(page.url()) ? 'payment' : 'refused';
}

/**
 * Signed in (usually as a second user): opens the show's seat map, selects the seat and clicks PROCEED, to find out
 * whether the seat can really be reserved. Returns how the seat was drawn and the outcome: 'food' / 'payment' (reserved:
 * the caller should cancel), 'refused' (still held by someone) or 'not selectable' (drawn as Unavailable).
 */
export async function tryToReserveSeat(page: Page, baseUrl: string, show: Show, id: string) {
  await reopenSeatMap(page, baseUrl, show); // Fresh seat map (General / Standard).
  const shown = await seatState(page, id); // How the seat is drawn.
  if (shown === 'available') await clickSeat(page, id); // Select it.
  if (await seatState(page, id) !== 'selected') return { shown, outcome: 'not selectable' as const };
  return { shown, outcome: await tryProceedFromSeatMap(page) };
}

/** On the food page, SKIP & PROCEED to the payment page. */
export async function skipFood(page: Page) {
  await page.getByRole('button', { name: /skip\s*(?:&|and)\s*proceed/i }).filter({ visible: true }).first().click(); // SKIP & PROCEED.
  await expect(page).toHaveURL(/\/payment\//, { timeout: 30_000 }); // Payment page.
}

/**
 * Waits for the payment page's order summary and returns the seat(s), the ticket line
 * ("Ticket Price KWD 3.500 x 2  KWD 7.000"), the food price and "Total amount to be paid".
 */
export async function readPaymentSummary(page: Page) {
  await expect(page.getByRole('heading', { name: /select payment method/i })).toBeVisible({ timeout: 30_000 }); // Payment page.
  let seatText = '';
  await expect.poll(async () => (seatText = readSummarySeat(await page.locator('body').innerText())), { timeout: 20_000 }).not.toBe(''); // Summary loaded.
  const text = flatText(await page.locator('body').innerText());
  const ticket = text.match(/Ticket Price\s*KWD\s*([\d.]+)\s*x\s*(\d+)\s*KWD\s*([\d.]+)/i); // Price, number of tickets, tickets total.
  return {
    seat: seatText, // e.g. "K18" or "K17K16".
    ticketPrice: ticket ? Number(ticket[1]) : undefined, // e.g. 3.5.
    tickets: ticket ? Number(ticket[2]) : undefined, // e.g. 2.
    ticketsTotal: ticket ? Number(ticket[3]) : undefined, // e.g. 7.
    food: readKwdAfter(text, 'Food Price') ?? 0, // e.g. 2 (0 when no food).
    total: readKwdAfter(text, 'Total amount to be paid'), // e.g. 9.
    text,
  };
}

/** Bookings paid in a page and not cancelled yet (by payWithWallet / payWithKnet; emptied by cancelBookingInMyProfile). */
const paidBookings = new WeakMap<Page, Set<string>>();

/** Notes a paid booking, so the clean-up after the test can cancel it if the test stops early. */
function rememberPaid<T extends { bookingId: string }>(page: Page, booking: T) {
  if (!paidBookings.has(page)) paidBookings.set(page, new Set());
  paidBookings.get(page)!.add(booking.bookingId);
  return booking;
}

/** Booking IDs paid in this page that have not been cancelled (used by the clean-up in tests/fixtures.ts). */
export const paidNotCancelled = (page: Page) => [...(paidBookings.get(page) ?? [])];

/** Pays with "Use your Wallet" and waits for the confirmation page; returns the Booking ID, date & time and Grand Total. */
export async function payWithWallet(page: Page) {
  const walletSection = page.getByRole('button', { name: /use your wallet/i }).last(); // "Use your Wallet".
  const apply = page.getByRole('button', { name: /^apply$/i }).first(); // Its Apply button.
  const remove = page.getByRole('button', { name: /^remove$/i }).first(); // Shown once applied.
  if (!await remove.isVisible().catch(() => false)) { // Wallet not applied yet:
    if (!await apply.isVisible().catch(() => false)) await walletSection.click(); // open the section,
    await apply.click(); // and apply the wallet balance.
    await expect(remove).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.locator('body')).toContainText(/wallet applied/i); // "Wallet applied".
  await page.getByRole('button', { name: 'Proceed', exact: true }).last().click(); // Proceed = pay.
  await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 60_000 }); // Confirmation page.
  return rememberPaid(page, await readConfirmation(page)); // Booking ID, date & time, Grand Total.
}

/**
 * Reads the confirmation page: Booking ID, date & time and Grand Total. The details are filled in a moment after the
 * page opens, so it waits until a real Booking ID is shown (an empty ID would match every booking card later on).
 */
export async function readConfirmation(page: Page) {
  const idHeading = page.getByText('Booking ID', { exact: true }).filter({ visible: true }).first() // The visible "Booking ID" label
    .locator('xpath=following-sibling::*[1]'); // and the heading next to it (IDs may be letters only, e.g. "WXKZMRB").
  let bookingId = '';
  await expect.poll(async () => (bookingId = flatText(await idHeading.innerText().catch(() => ''))),
    { message: 'The confirmation page should show the Booking ID', timeout: 30_000 }).toMatch(/^[A-Z0-9]{5,}$/);
  const dateTime = flatText(await page.getByRole('heading', { name: /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s*\|\s*\d{1,2}:\d{2}$/ })
    .filter({ visible: true }).first().innerText()); // "01 Oct 2026 | 20:35".
  const grandTotal = readKwdAfter(await page.locator('body').innerText(), 'Grand Total'); // e.g. 3.5.
  return { bookingId, dateTime, grandTotal };
}

/** KNET test card details (from .env: TEST_KNET_NUMBER, TEST_KNET_EXPIRY as MM/YY, TEST_KNET_PIN as 4 digits). */
export interface KnetCard { knetNumber: string; knetExpiry: string; knetPin: string }

/** On the payment page: chooses KNET (without the wallet) and clicks Proceed; waits for the KNET test gateway page. */
export async function startKnetPayment(page: Page) {
  const remove = page.getByRole('button', { name: /^remove$/i }).first(); // Wallet "Remove" (only if the wallet was applied).
  if (await remove.isVisible().catch(() => false)) await remove.click(); // Take the wallet off, so KNET pays the full amount.
  const knet = page.getByText('KNET', { exact: true }).filter({ visible: true }).first(); // KNET option.
  if (!await knet.isVisible().catch(() => false)) await page.getByRole('button', { name: /pay with debit or credit card/i }).last().click(); // Open the card section.
  await knet.click(); // Choose KNET.
  await page.getByRole('button', { name: 'Proceed', exact: true }).last().click(); // Proceed to the gateway.
  await page.waitForURL(/kpay/i, { timeout: 60_000 }); // KNET test gateway (kpaytest.com.kw).
}

/** Pays with KNET on the KNET test gateway and waits for the confirmation page (same steps as WEB-04). */
export async function payWithKnet(page: Page, card: KnetCard) {
  await startKnetPayment(page); // KNET chosen; on the gateway page.
  const hide = (input: Locator) => input.evaluate((element) => { (element as HTMLElement).style.setProperty('color', 'transparent', 'important'); }); // Hide typed card data in screenshots.
  const number = page.locator('#debitNumber'); // Card number box.
  const expiry = page.getByPlaceholder('MM/YY').filter({ visible: true }).first(); // Expiry box.
  const pin = page.locator('input[title*="PIN" i]').filter({ visible: true }).first(); // PIN box.
  await expect(number).toBeVisible({ timeout: 30_000 });
  for (const input of [number, expiry, pin]) await hide(input);
  await number.fill(card.knetNumber); // Card number.
  await expiry.fill(card.knetExpiry); // Expiry MM/YY.
  if (!/^\d{2}\/\d{2}$/.test(await expiry.inputValue())) { await expiry.fill(''); await expiry.pressSequentially(card.knetExpiry.replace(/\D/g, '')); } // Typed as digits if reformatted.
  await pin.fill(card.knetPin); // PIN.
  await page.getByRole('button', { name: /^submit$/i }).filter({ visible: true }).first().click(); // Submit.
  const confirm = page.getByRole('button', { name: /^confirm$/i }).filter({ visible: true }).first(); // Optional Confirm page.
  await expect.poll(async () => /cinescape\.com\.kw/i.test(page.url()) || await confirm.isVisible().catch(() => false), { timeout: 60_000 }).toBe(true);
  if (!/cinescape\.com\.kw/i.test(page.url())) await confirm.click(); // Confirm the payment if asked.
  await expect(page).toHaveURL(/bookingconfirm\?result=success/i, { timeout: 90_000 }); // Confirmation page.
  return rememberPaid(page, await readConfirmation(page)); // Booking ID, date & time, Grand Total.
}

/** The booking card in My Account > Bookings for this Booking ID (the visible card with its title and Cancel button). */
export function bookingCard(page: Page, bookingId: string, title: RegExp) {
  return page.locator('div').filter({ visible: true })
    .filter({ has: page.getByText(bookingId, { exact: true }) }) // Holds an element showing exactly this ID (<h3>WPGPH7J</h3>).
    .filter({ hasText: title })
    .filter({ has: page.locator('button, a').filter({ hasText: /cancel booking/i }).filter({ visible: true }) }).last(); // (each card also has a hidden phone copy)
}

/** Opens My Account > Bookings (the booking list). */
export async function openBookings(page: Page) {
  await page.locator('a[href="/myaccount"], nav.header-nav .user-profile:visible').first().click(); // Header > My Account.
  await expect(page).toHaveURL(/\/myaccount/);
  await page.getByText(/^bookings$/i).first().click(); // BOOKINGS tab.
  await expect(page.getByText(/upcoming bookings/i).first()).toBeVisible({ timeout: 30_000 }); // "UPCOMING BOOKINGS".
}

/** Booking IDs of the visible booking cards in My Account > Bookings (UPCOMING BOOKINGS), e.g. ["WRK7RP2"]. */
export async function upcomingBookingIds(page: Page) {
  const text = flatText((await page.locator('body').innerText())); // Page text (hidden mobile copies are not included).
  return [...new Set([...text.matchAll(/booking id\s*:?\s*([A-Z0-9]{5,})/gi)].map((match) => match[1]))]; // Each ID once.
}

/** Cancels a confirmed booking from its card in My Account > Bookings (Cancel Booking, then "Yes, I'm sure"). */
export async function cancelBookingInMyProfile(page: Page, bookingId: string, title: RegExp) {
  expect(bookingId, 'A Booking ID is needed to cancel the right booking').toMatch(/^[A-Z0-9]{5,}$/); // Never "any card".
  const card = bookingCard(page, bookingId, title); // The booking's card.
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.locator('button:visible, a:visible').filter({ hasText: /cancel booking/i }).first().click(); // Cancel Booking.
  const confirm = page.locator('button:visible').filter({ hasText: /yes,?\s*I.?m sure|confirm|cancel booking/i }).last(); // "Yes, I'm sure".
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/content/trans/cancelbooking' && r.request().method() === 'POST', { timeout: 30_000 });
  await confirm.click(); // Confirm the cancellation.
  expect((await answer).ok(), 'The cancellation request should succeed').toBeTruthy(); // The site accepted it.
  paidBookings.get(page)?.delete(bookingId); // Cancelled: nothing to clean up.
}

/** Cancels a booking in progress: Cancel on the food or payment page, then "Yes" to "Are you sure you want to cancel transaction?". */
export async function cancelDuringBooking(page: Page) {
  await page.getByRole('button', { name: /^cancel$/i }).filter({ visible: true }).last().click(); // Cancel.
  const confirm = page.locator('.swal2-popup:visible, .swal-overlay--show-modal .swal-modal') // The open confirmation pop-up
    .getByRole('button', { name: /^(?:yes|ok|confirm)/i }).first(); // and its "Yes".
  if (await appears(confirm, 5_000)) await confirm.click(); // Confirm if asked (shown a moment after Cancel).
  await expect(page).not.toHaveURL(/\/(?:food|payment|seatlayout)/, { timeout: 30_000 }); // Left the booking pages.
}
