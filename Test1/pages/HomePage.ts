import { expect, Locator, Page } from '@playwright/test';

export class HomePage {
  readonly logo: Locator;
  readonly nowShowing: Locator;
  readonly bookNowLinks: Locator;
  readonly header: Locator;
  readonly searchControl: Locator;
  readonly searchInput: Locator;
  readonly languageControl: Locator;
  readonly languageButton: Locator;
  readonly englishControl: Locator;
  readonly profileControl: Locator;
  readonly profileDialog: Locator;
  readonly menuControl: Locator;
  readonly menuPanel: Locator;
  readonly experienceSection: Locator;
  readonly locationSection: Locator;
  readonly promotionsSection: Locator;

  constructor(private readonly page: Page) {
    this.logo = page.getByRole('img', { name: 'cinescape-logo' });
    this.nowShowing = page.getByRole('link', { name: 'Now Showing' }).first();
    this.bookNowLinks = page.locator('a[href*="/moviesessions/"]');
    this.header = page.locator('img[alt="cinescape-logo"]').first();
    this.searchControl = page.locator('nav.header-nav .search-input-contain:visible');
    this.searchInput = page.locator('nav.header-nav input[type="search"]');
    this.languageControl = page.locator('nav.header-nav .nav-right > .symbol:visible');
    this.languageButton = this.languageControl.locator('a');
    this.englishControl = page.locator('nav.header-nav .nav-right > .symbol:has-text("EN") > a:visible');
    this.profileControl = page.locator('nav.header-nav .user-profile:visible');
    this.profileDialog = page.locator('[role="dialog"]');
    this.menuControl = page.locator('nav.header-nav .nav-menu.pointer-cursor:visible');
    this.menuPanel = page.locator('.slider-menu');
    this.experienceSection = page.locator('section.experience-sect');
    this.locationSection = page.locator('section.location-section');
    this.promotionsSection = page.locator('section.promotions');
  }

  async open(url = '/') {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async expectLoaded() {
    await expect(this.logo).toBeVisible();
    await expect(this.nowShowing).toBeVisible();
    await expect(this.bookNowLinks.first()).toBeVisible();
  }

  async expectStaticNavigation() {
    for (const name of ['Home', 'Movies', 'Experience', 'Promotions', 'News', 'Corporate', 'Contact Us']) {
      const headerLink = this.page.locator('a').filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
      await expect(headerLink).toBeAttached();
    }
  }

  async expectMoviesDisplayed() {
    await expect(this.bookNowLinks.first()).toBeVisible();
    await expect(this.bookNowLinks).not.toHaveCount(0);
  }

  async expectExperiencesDisplayed() {
    await expect(this.experienceSection).toBeVisible();
    await expect(this.experienceSection.locator('h3')).toHaveText(/Experiences/i);
    await expect(this.experienceSection.locator('a[href="/experiences"]').first()).toBeVisible();
    await expect(this.experienceSection.locator('img')).toHaveCount(4);
  }

  async expectLocationsDisplayed() {
    await expect(this.locationSection).toBeVisible();
    await expect(this.locationSection.locator('h3')).toHaveText(/Cinescape Locations/i);
    await expect(this.locationSection.locator('a[href*="/cinemasessions/"]').first()).toBeVisible();
    await expect(this.locationSection.locator('p').first()).toBeVisible();
  }

  async expectPromotionsDisplayed() {
    await expect(this.promotionsSection).toBeVisible();
    await expect(this.promotionsSection.locator('h3')).toHaveText(/Events & Promotions/i);
    await expect(this.promotionsSection.locator('a[href="/promotion"]').first()).toBeVisible();
    await expect(this.promotionsSection.locator('img').first()).toBeAttached();
    await expect(this.promotionsSection.locator('img').first()).toHaveAttribute('src', /.+/);
  }

  async highlight(locator: Locator, label: string) {
    await locator.evaluate((element, markerText) => {
      document.getElementById('playwright-report-marker')?.remove();
      const marker = document.createElement('div');
      marker.id = 'playwright-report-marker';
      marker.textContent = markerText;
      marker.style.cssText = [
        'position:fixed',
        'left:24px',
        'top:88px',
        'z-index:2147483647',
        'padding:10px 16px',
        'border:3px solid #ff4d6d',
        'border-radius:8px',
        'background:#ff4d6d',
        'color:#ffffff',
        'font:700 16px Arial,sans-serif',
        'box-shadow:0 2px 8px rgba(0,0,0,.45)',
        'pointer-events:none',
      ].join(';');
      element.setAttribute('data-playwright-highlight', 'true');
      element.style.outline = '4px solid #ffd166';
      element.style.outlineOffset = '6px';
      element.style.boxShadow = '0 0 0 8px rgba(255, 209, 102, 0.35)';
      document.body.appendChild(marker);
    }, label);
    await this.page.waitForTimeout(500);
  }

  async closeSearch() {
    await this.page.locator('.overlay:visible').click({ position: { x: 5, y: 5 } });
    await expect(this.searchInput).toBeHidden();
  }

  async closeProfile() {
    await this.profileDialog.getByRole('button').first().click();
    await expect(this.profileDialog).toBeHidden();
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
