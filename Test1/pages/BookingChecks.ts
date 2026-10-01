// Checks shared by the two booking tests (wallet and KNET): movie details, the confirmed ticket,
// the 2-hour cancellation window and the wallet balance. Checks that run after a booking is paid are
// "soft" (expect.soft): a mismatch is reported, but the test carries on and still cancels the booking.
import { expect, Locator, Page } from '@playwright/test';

/** What the customer chose while booking, to compare with the confirmation page and the booking card. */
export interface TicketChoice {
  title: RegExp; // Movie title (flexible pattern built from the movie URL).
  language: string; // Language from the movie URL, e.g. "English".
  location: string; // Cinema, e.g. "Cinescape 360".
  day: string; // Day of the month chosen on the date tab, e.g. "01".
  time: string; // Show time chosen, e.g. "20:35".
  category: string; // Seat category chosen, e.g. "General". (The seat type is not shown on the ticket.)
  seat: string; // Seat shown in the payment summary, e.g. "K18".
}

/** Page text on one line: look-alike characters unified, invisible marks removed, spaces collapsed. */
export const flatText = (text: string) => text
  .normalize('NFKC')
  .replace(/[​-‏‪-‮⁦-⁩]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameText = (a: string, b: string) => flatText(a).toLowerCase() === flatText(b).toLowerCase();

/** Flexible title pattern from the movie URL words ("the buckingham murders hindi" matches "The Buckingham Murders - Hindi"). */
export const titlePattern = (title: string) => new RegExp(title.split(/\s+/).map(escapeRegExp).join('[\\s()-]*'), 'i');

/** The amount after a label, e.g. readKwdAfter(text, 'Grand Total') for "Grand Total KWD 3.500" gives 3.5. */
export function readKwdAfter(text: string, label: string): number | undefined {
  const match = flatText(text).match(new RegExp(`${escapeRegExp(label)}\\s*KWD\\s*([\\d,]+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1].replace(/,/g, '')) : undefined;
}

/** The "Wallet Balance KWD ..." shown at the top of My Account (waits until it has loaded). */
export async function readWalletBalance(page: Page): Promise<number> {
  let balance: number | undefined;
  await expect.poll(async () => {
    balance = readKwdAfter(await page.locator('body').innerText(), 'Wallet Balance');
    return balance;
  }, { message: 'My Account should show the wallet balance', timeout: 20_000 }).toBeDefined();
  return balance as number;
}

/** The first amount in a text, e.g. readKwd("Standard 112 Available KWD 3.500") gives 3.5. */
export function readKwd(text: string): number | undefined {
  const match = flatText(text).match(/KWD\s*([\d,]+(?:\.\d+)?)/i);
  return match ? Number(match[1].replace(/,/g, '')) : undefined;
}

/** KWD in fils (1 KWD = 1000 fils), so amounts can be compared as whole numbers without rounding surprises. */
export const fils = (kwd: number | undefined) => Math.round((kwd ?? Number.NaN) * 1000);

/** Seat(s) listed in the payment summary: "Seat K18" gives "K18"; two seats are shown run together, "Seat K17K16" gives "K17K16". */
export function readSummarySeat(text: string): string {
  return flatText(text).match(/\bSeats?\s+([A-Z]{1,2}\d{1,3}(?:(?:\s*,\s*)?[A-Z]{1,2}\d{1,3})*)\b/)?.[1] ?? '';
}

/** The single seats in a seat text, e.g. "K17K16" or "K17, K16" gives ["K17", "K16"]. */
export const seatList = (seats: string) => seats.match(/[A-Z]{1,2}\d{1,3}/g) ?? [];

/** Hours from now until a show written as "29 Sep 2026 | 20:35" (Kuwait time, UTC+3). */
export function hoursUntilShow(dateTime: string, now = new Date()): number {
  const match = flatText(dateTime).match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})/);
  if (!match) return Number.NaN;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].toLowerCase());
  const showTime = Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4]) - 3, Number(match[5]));
  return (showTime - now.getTime()) / 3_600_000;
}

/** Minutes in a running time such as "80 MIN" (homepage) or "1 hr 20 min" (movie page). */
export function runTimeMinutes(text: string): number {
  const hours = /(\d+)\s*h/i.exec(text);
  const minutes = /(\d+)\s*m/i.exec(text);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

/** Details on the homepage movie card that holds this Book Now link. */
export async function readHomeMovieCard(bookNow: Locator) {
  const card = bookNow.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " banner-item ")][1]');
  const found = await card.count() > 0;
  const read = async (selector: string) => (found ? (await card.locator(selector).first().textContent()) ?? '' : '').trim();
  return {
    title: await read('.title-info'),
    rating: await read('.age-highlight'),
    language: await read('.lang'),
    genre: await read('.movie-about'),
    runTime: await read('.length'),
  };
}

/** Details on the movie page: title plus each label / value pair (language, genre, director, cast...). */
export async function readMovieDetails(page: Page): Promise<Record<string, string>> {
  const boxes = page.locator('.movie-info-box');
  await expect(boxes.first()).toBeVisible({ timeout: 30_000 });
  // The values are filled in a moment after the labels appear.
  await expect.poll(async () => ((await boxes.first().locator('p').nth(1).textContent()) ?? '').trim(), { timeout: 20_000 }).not.toBe('');
  const pairs = await boxes.evaluateAll((elements) => elements.map((element) =>
    [...element.querySelectorAll('p')].map((p) => (p.textContent ?? '').trim())));
  const details: Record<string, string> = { title: ((await page.locator('h3.title-info').first().textContent()) ?? '').trim() };
  for (const [label, value] of pairs) {
    if (label) details[label.toLowerCase()] = value ?? '';
  }
  return details;
}

/** Soft-checks the movie details are shown and agree with the homepage card. */
export function expectMovieDetails(card: Awaited<ReturnType<typeof readHomeMovieCard>>, details: Record<string, string>) {
  for (const [name, value] of Object.entries(card)) {
    expect.soft(value, `Homepage movie card should show the ${name}`).not.toBe('');
  }
  for (const name of ['language', 'genre', 'subtitle', 'run time', 'director', 'cast', 'synopsis']) {
    expect.soft(details[name] ?? '', `Movie page should show the ${name}`).not.toBe('');
  }
  expect.soft(sameText(details.title, card.title), `Movie page title "${details.title}" should match the homepage card "${card.title}"`).toBe(true);
  expect.soft(sameText(details.language ?? '', card.language), `Movie page language "${details.language}" should match the homepage card "${card.language}"`).toBe(true);
  expect.soft(sameText(details.genre ?? '', card.genre), `Movie page genre "${details.genre}" should match the homepage card "${card.genre}"`).toBe(true);
  expect.soft(runTimeMinutes(details['run time'] ?? ''), `Movie page run time "${details['run time']}" should match the homepage card "${card.runTime}"`)
    .toBe(runTimeMinutes(card.runTime));
}

/** Soft-checks a ticket view (payment summary, confirmation page or booking card) shows what was chosen. */
export async function expectTicketMatchesChoice(view: Locator, choice: TicketChoice, where: string, fields = 'all' as 'all' | 'summary') {
  const text = flatText(await view.innerText());
  expect.soft(text, `${where}: movie title`).toMatch(choice.title);
  expect.soft(text, `${where}: language ${choice.language}`).toMatch(new RegExp(`\\b${escapeRegExp(choice.language)}\\b`, 'i'));
  expect.soft(text, `${where}: location ${choice.location}`).toMatch(new RegExp(`Location\\s*${escapeRegExp(choice.location)}`, 'i'));
  expect.soft(text, `${where}: date and time`).toMatch(
    new RegExp(`\\b0?${Number(choice.day)}\\s+[A-Za-z]{3,9}\\s+\\d{4}\\s*\\|\\s*${escapeRegExp(choice.time)}\\b`));
  expect.soft(text, `${where}: seat ${choice.seat}`).toMatch(new RegExp(`\\bSeats?\\s*${escapeRegExp(choice.seat)}\\b`));
  if (fields === 'summary') return; // The payment summary has no category line.
  expect.soft(text, `${where}: category ${choice.category}`).toMatch(new RegExp(`Category\\s*${escapeRegExp(choice.category)}`, 'i'));
}

/** The booking card in My Account > Bookings: the smallest block holding this Booking ID, the movie title and its Cancel button. */
export function bookingCard(page: Page, bookingId: string, title: RegExp): Locator {
  return page.locator('div')
    .filter({ visible: true }) // Each card also has a hidden copy for the mobile layout.
    .filter({ hasText: bookingId })
    .filter({ hasText: title }) // The title sits outside the details column, so this selects the whole card.
    .filter({ has: page.locator('button, a').filter({ hasText: /cancel booking/i }) })
    .last();
}
