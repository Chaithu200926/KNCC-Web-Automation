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
    await this.page.goto('/');
  }

  async expectLoaded() {
    await expect(this.logo).toBeVisible();
    await expect(this.nowShowing).toBeVisible();
    await expect(this.bookNowLinks.first()).toBeVisible();
  }

  async openFirstMovieSession() {
    const movieSessionUrl = await this.bookNowLinks.first().getAttribute('href');
    expect(movieSessionUrl).toBeTruthy();
    await this.page.goto(movieSessionUrl!);
  }
}
