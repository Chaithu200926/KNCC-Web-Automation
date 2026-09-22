import { expect, Locator, Page } from '@playwright/test';

export class HomePage {
  readonly logo: Locator;
  readonly nowShowing: Locator;
  readonly bookNowLinks: Locator;

  constructor(private readonly page: Page) {
    this.logo = page.getByRole('img', { name: 'cinescape-logo' });
    this.nowShowing = page.getByRole('link', { name: 'Now Showing' }).first();
    this.bookNowLinks = page.locator('a[href*="/moviesessions/"]');
  }

  async open() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  async expectLoaded() {
    await expect(this.logo).toBeVisible();
    await expect(this.nowShowing).toBeVisible();
    await expect(this.bookNowLinks.first()).toBeVisible();
  }

  async prepareFirstMovieSessionSelection() {
    const firstMovieSession = this.bookNowLinks.first();
    await expect(firstMovieSession).toBeVisible();
    await firstMovieSession.scrollIntoViewIfNeeded();
    await firstMovieSession.focus();
    await firstMovieSession.evaluate((element) => {
      element.style.outline = '4px solid #ffd166';
      element.style.outlineOffset = '5px';
      element.style.boxShadow = '0 0 0 8px rgba(255, 209, 102, 0.35)';
    });
    await firstMovieSession.evaluate((element) => {
      const existingMarker = document.getElementById('playwright-click-marker');
      existingMarker?.remove();

      const bounds = element.getBoundingClientRect();
      const marker = document.createElement('div');
      marker.id = 'playwright-click-marker';
      marker.textContent = '1  CLICK';
      marker.style.cssText = [
        'position:absolute',
        `left:${Math.max(8, bounds.left + window.scrollX - 8)}px`,
        `top:${Math.max(8, bounds.top + window.scrollY - 42)}px`,
        'z-index:2147483647',
        'padding:6px 10px',
        'border:3px solid #ff4d6d',
        'border-radius:999px',
        'background:#ff4d6d',
        'color:#ffffff',
        'font:700 13px Arial,sans-serif',
        'box-shadow:0 2px 8px rgba(0,0,0,.45)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(marker);
    });

  }

  async openFirstMovieSession() {
    const firstMovieSession = this.bookNowLinks.first();
    const movieSessionUrl = await firstMovieSession.getAttribute('href');
    expect(movieSessionUrl).toBeTruthy();
    await firstMovieSession.evaluate((element) => (element as HTMLAnchorElement).click());
    await this.page.waitForURL(/\/moviesessions\//, { waitUntil: 'domcontentloaded' });
  }
}
