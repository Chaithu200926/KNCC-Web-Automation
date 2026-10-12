// Small helpers shared by the website test cases (WEB-xx): opening pages on the slow UAT site,
// the language switch, and reading the movie cards on the Movies page.
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and the browser page / element types.

/**
 * Waits up to `timeout` ms for an element to be shown and says whether it was. (Playwright's isVisible() answers at once
 * and ignores a timeout, so it cannot be used to wait for a message that the site shows a moment later.)
 */
export const appears = (locator: Locator, timeout: number) => locator.waitFor({ state: 'visible', timeout }).then(() => true, () => false);

// The UAT site can take over 30 s to finish loading, so pages are opened without waiting for "load"
// and the tests wait for the element they need instead.
const LONG = { timeout: 90_000 }; // Up to 90 s for the first element of a page.

/** Opens the homepage and waits for the movie list. */
export async function openHome(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: 'commit', ...LONG }); // Start loading the homepage.
  await expect(page.locator('a[href*="/moviesessions/"]').first()).toBeVisible(LONG); // Ready once a Book Now link shows.
}

/** Opens the Movies page (Now Showing tab) and waits for its tabs. */
export async function openMovies(page: Page, baseUrl: string) {
  await page.goto(new URL('/movies', baseUrl).toString(), { waitUntil: 'commit', ...LONG }); // Start loading /movies.
  await expect(moviesTabs(page)).toBeVisible(LONG); // Ready once the tab bar shows.
}

/** The tab bar on the Movies page (Now Showing, Advance Booking, New This Week, Last Chance to Watch, Coming Soon). */
export const moviesTabs = (page: Page) => page.locator('.filter-categories').filter({ visible: true }).first(); // Desktop copy only.

/** Clicks a Movies page tab and returns the movie cards shown (poster title and link). */
export async function openMoviesTab(page: Page, tab: string) {
  await moviesTabs(page).getByText(tab, { exact: true }).click(); // Click the tab by its name.
  await page.waitForTimeout(2_000); // The list is filtered in the browser; give it a moment to redraw.
  return movieCards(page); // The movies now listed.
}

/** The movie cards currently shown on the Movies page: title (poster alt), link, age rating and tag. */
export async function movieCards(page: Page) {
  return page.locator('.now-showing-preview').filter({ visible: true }).evaluateAll((cards) => cards.map((card) => ({
    title: (card.querySelector('img[src*="/movies/"]')?.getAttribute('alt') ?? '').trim(), // Poster "alt" text = movie title.
    href: card.querySelector('a[href]:not([href=""])')?.getAttribute('href') ?? '', // Link to the movie page.
    rating: (card.querySelector('.age-highlight')?.textContent ?? '').trim(), // Age rating badge (G, PG12...).
    tag: (card.querySelector('.new_release')?.textContent ?? '').trim(), // Corner tag (NEW, INFINITY...), if any.
  })));
}

/** The movie cards once the list has loaded (it fills in a moment after the tabs appear). */
export async function loadedMovieCards(page: Page) {
  await expect.poll(async () => (await movieCards(page)).length, { message: 'The Movies page should list movies', timeout: 30_000 })
    .toBeGreaterThan(0); // Wait until at least one card is shown.
  return movieCards(page); // Then read them.
}

/** The header language button (shows the other language: the Arabic letter in English, "EN" in Arabic). */
export const languageButton = (page: Page) => page.locator('nav.header-nav .nav-right > .symbol:visible a');

/** Switches the site language and waits until the page direction matches (Arabic = right-to-left). */
export async function switchLanguage(page: Page, to: 'ar' | 'en') {
  await languageButton(page).click(); // Click the language button in the header.
  const direction = expect.poll(async () => (await page.locator('html').getAttribute('dir')) ?? '', { timeout: 30_000 }); // Page direction.
  await (to === 'ar' ? direction.toBe('rtl') : direction.not.toBe('rtl')); // Arabic: right-to-left; English: not.
}

/** Share of Arabic letters among all letters in a text (0 = none, 1 = all Arabic). */
export function arabicShare(text: string) {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length; // Count Arabic letters.
  const latin = (text.match(/[A-Za-z]/g) ?? []).length; // Count English (Latin) letters.
  return arabic + latin === 0 ? 0 : arabic / (arabic + latin); // Arabic share of both.
}

/** Images that finished loading but failed (broken), ignoring the site's built-in data: icons. */
export async function brokenImages(page: Page) {
  return page.locator('img').evaluateAll((images) => images
    .filter((image) => {
      const img = image as HTMLImageElement;
      return img.complete && img.naturalWidth === 0 && !!img.currentSrc && !img.currentSrc.startsWith('data:'); // Loaded, but no picture.
    })
    .map((image) => `${(image as HTMLImageElement).alt || '(no alt)'}: ${(image as HTMLImageElement).currentSrc}`)); // "title: address".
}

/** Scrolls to the bottom in steps so lazy-loaded images get loaded, then back to the top. */
export async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight); // Page height in pixels.
  for (let y = 0; y < height; y += 600) { // Scroll down 600 px at a time
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150); // with a short pause so images start loading.
  }
  await page.waitForTimeout(2_000); // Let the last images finish.
  await page.evaluate(() => window.scrollTo(0, 0)); // Back to the top.
}

/** Minutes since midnight for a "HH:MM" show time (e.g. "20:35" → 1235). */
export const minutesOf = (time: string) => {
  const match = time.match(/(\d{1,2}):(\d{2})/); // Hours and minutes.
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN; // Not a time → NaN.
};

/** The five tabs of the Movies page. */
export const MOVIES_TABS = ['Now Showing', 'Advance Booking', 'New This Week', 'Last Chance to Watch', 'Coming Soon'];

/** Two titles are the same when they match ignoring upper / lower case and extra spaces. */
export const sameTitle = (a: string, b: string) =>
  a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/** A title as a case-insensitive pattern (special characters such as ":" or "(" escaped). */
export const titleRegExp = (title: string) => new RegExp(title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** The movies in the homepage banner: title, rating, language, genre, run time, trailer and Book Now link. */
export async function bannerMovies(page: Page) {
  const all = await page.locator('.banner-item').evaluateAll((items) => items.map((item) => ({ // Read every banner item:
    title: (item.querySelector('.title-info')?.textContent ?? '').trim(), // movie title,
    rating: (item.querySelector('.age-highlight')?.textContent ?? '').trim(), // age rating (G, PG12...),
    language: (item.querySelector('.lang')?.textContent ?? '').trim(), // language,
    genre: (item.querySelector('.movie-about')?.textContent ?? '').trim(), // genre,
    runTime: (item.querySelector('.length')?.textContent ?? '').trim(), // running time (e.g. "80 MIN"),
    trailer: !!item.querySelector('.banner-trailer'), // whether WATCH TRAILER is offered,
    bookNow: item.querySelector('a[href*="/moviesessions/"]')?.getAttribute('href') ?? '', // and the Book Now link.
  })));
  // The carousel repeats items, so keep one entry per movie (by its Book Now link).
  return [...new Map(all.filter((movie) => movie.bookNow).map((movie) => [movie.bookNow, movie])).values()];
}

/** Current time in Kuwait (UTC+3) as minutes since midnight (the test machine may be in another time zone). */
export const kuwaitMinutesNow = (now = new Date()) => ((now.getUTCHours() + 3) % 24) * 60 + now.getUTCMinutes();
