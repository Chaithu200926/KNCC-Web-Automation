// Sign-in / sign-out helpers for the website test cases (WEB-xx) that need the test account.
// The account details come from .env (TEST_USERNAME, TEST_PASSWORD, TEST_PIN = the email OTP on UAT).
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and types.

export interface Credentials { username: string; password: string; pin: string } // Test account from testConfig.credentials.

/** The sign-in dialog (Email, Password, Forgot Password?, Sign in, "Not Registered? SIGN UP"). */
export const signInDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ has: page.locator('input[name="email"]') }).last();

/** The "VERIFY EMAIL OTP" dialog that follows a correct email and password. */
export const otpDialog = (page: Page) => page.locator('[role="dialog"]').filter({ hasText: /verify email otp/i }).last();

/** The site's message pop-up (e.g. "Please enter a valid username and password.") and its OK button. */
export const messagePopup = (page: Page) => page.locator('.swal-modal:visible').last();

/** Link to My Account in the header; it appears only when signed in. */
export const myAccountLink = (page: Page) => page.locator('a[href="/myaccount"]').first();

/** Opens the sign-in dialog from the header profile icon. */
export async function openSignInDialog(page: Page) {
  await page.locator('nav.header-nav .user-profile:visible').first().click(); // Click the profile icon.
  await expect(signInDialog(page)).toBeVisible({ timeout: 30_000 }); // The dialog opens.
}

/** Types an email and password into the open sign-in dialog and clicks Sign in. */
export async function submitSignIn(page: Page, email: string, password: string) {
  const dialog = signInDialog(page); // The open sign-in dialog.
  await dialog.locator('input[name="email"]').fill(email); // Email.
  await dialog.locator('input[name="password"]').fill(password); // Password.
  await dialog.getByRole('button', { name: /^sign in$/i }).last().click(); // Sign in.
}

/** Types an OTP into the "VERIFY EMAIL OTP" boxes (one box per digit) and clicks Submit. */
export async function submitOtp(page: Page, otp: string) {
  const boxes = otpDialog(page).locator('input[type="tel"]'); // The OTP boxes.
  await expect(boxes.first()).toBeVisible({ timeout: 60_000 }); // Wait for them (sign-in can take up to a minute on UAT).
  for (let index = 0; index < otp.length; index += 1) await boxes.nth(index).fill(otp[index]); // One digit per box.
  await otpDialog(page).getByRole('button', { name: /submit/i }).click(); // Submit.
}

/** Full sign-in from the open dialog: email + password, then the email OTP; waits until signed in. */
export async function completeSignIn(page: Page, account: Credentials) {
  await submitSignIn(page, account.username, account.password); // Email and password.
  await submitOtp(page, account.pin); // The email OTP.
  await expect(otpDialog(page)).toBeHidden({ timeout: 30_000 }); // The OTP dialog closes.
  await expect(myAccountLink(page)).toBeAttached({ timeout: 30_000 }); // The header now links to My Account.
}

/** Signs in from the header (profile icon) with the test account. */
export async function signIn(page: Page, account: Credentials) {
  await openSignInDialog(page); // Open the dialog.
  await completeSignIn(page, account); // Email, password and OTP.
}

/** Signs out with MENU > LOGOUT and waits until the header no longer links to My Account. */
export async function signOut(page: Page) {
  await page.locator('nav.header-nav .nav-menu.pointer-cursor:visible').click(); // Open MENU.
  // LOGOUT sits in the slide-out menu, which Playwright reports as hidden while it slides, so click the link directly.
  await page.locator('a').filter({ hasText: /^logout$/i }).first().evaluate((link) => (link as HTMLAnchorElement).click());
  await expect(page.locator('a[href="/myaccount"]')).toHaveCount(0, { timeout: 30_000 }); // No My Account link any more.
}

/** Opens My Account from the header and waits for "Welcome back". */
export async function openMyAccount(page: Page) {
  await myAccountLink(page).click(); // Click the name / My Account link in the header.
  await expect(page).toHaveURL(/\/myaccount/); // My Account opens.
  await expect(page.locator('.account-left').filter({ visible: true }).getByText(/welcome back/i)).toBeVisible({ timeout: 30_000 }); // Greeting (desktop copy).
}

/** Opens a My Account tab (PROFILE, BOOKINGS, PREFERENCES, RECHARGE WALLET, HISTORY). */
export async function openAccountTab(page: Page, tab: string): Promise<Locator> {
  const link = page.getByText(new RegExp(`^${tab}$`, 'i')).first(); // The tab by its name.
  await link.click(); // Open it.
  return link;
}

/** Closes the site's message pop-up with OK (it may stay in the page afterwards, but no longer blocks it). */
export async function closeMessage(page: Page) {
  await messagePopup(page).getByRole('button', { name: /^ok$/i }).click(); // Click OK.
}
