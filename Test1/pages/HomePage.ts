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
      const button = element.querySelector('button');
      const highlight = '4px solid #ffd166';

      const marker = document.createElement('div');
      marker.id = 'playwright-click-marker';
      marker.textContent = 'STEP 2 - CLICK BOOK NOW';
      marker.style.cssText = [
        'position:fixed',
        'left:24px',
        'top:88px',
        'z-index:2147483647',
        'padding:10px 16px',
        'border:4px solid #ff4d6d',
        'border-radius:8px',
        'background:#ff4d6d',
        'color:#ffffff',
        'font:700 16px Arial,sans-serif',
        'box-shadow:0 2px 8px rgba(0,0,0,.45)',
        'pointer-events:none',
      ].join(';');
      element.style.position = 'relative';
      element.style.outline = highlight;
      element.style.outlineOffset = '6px';
      if (button) {
        button.style.outline = highlight;
        button.style.outlineOffset = '4px';
        button.style.boxShadow = '0 0 0 8px rgba(255, 209, 102, 0.45)';
      }
      document.body.appendChild(marker);
    });

  }

  async openFirstMovieSession() {
    const firstMovieSession = this.bookNowLinks.first();
    const movieSessionUrl = await firstMovieSession.getAttribute('href');
    expect(movieSessionUrl).toBeTruthy();
    await firstMovieSession.evaluate((element) => (element as HTMLAnchorElement).click());
    await this.page.waitForLoadState('domcontentloaded');
  }
}
