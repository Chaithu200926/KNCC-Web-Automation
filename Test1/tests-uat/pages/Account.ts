// Sign-in / sign-out helpers for the website test cases (WEB-xx) that need the test account.
// The account details come from .env (TEST_USERNAME, TEST_PASSWORD, TEST_PIN = the email OTP on UAT).
import { expect, Locator, Page, test } from '@playwright/test'; // Playwright's checks, types and the running test.

export interface Credentials { username: string; password: string; pin: string } // Test account from testConfig.credentials.

/** The sign-in dialog (Email, Password, Forgot Password?, Sign in, "Not Registered? SIGN UP"). */
export const signInDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ has: page.locator('input[name="email"]') }).last();

/** The OTP dialog that follows a correct email and password: "VERIFY EMAIL OTP" or (once the user is verified) "VERIFY SMS OTP". */
export const otpDialog = (page: Page) => page.locator('[role="dialog"]').filter({ hasText: /verify (email|sms) otp/i }).last();

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
  await clickSignInWaitingForOtpLimit(page, () => dialog.getByRole('button', { name: /^sign in$/i }).last().click()); // Sign in.
}

/**
 * This site sends at most one OTP per account every few minutes: a sign-in inside that time is refused with "Please
 * wait N minutes M seconds before requesting another OTP" (API code 12001; the page only shows "Please enter a valid
 * username and password"). Clicks Sign in with `click`; when refused that way, closes the message, waits as long as the
 * site asks (the test's time limit grows by the same amount, noted on the test as "OTP limit") and clicks again.
 */
export async function clickSignInWaitingForOtpLimit(page: Page, click: () => Promise<void>) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const answer = page.waitForResponse((response) => /\/api\/customer\/login$/i.test(new URL(response.url()).pathname), { timeout: 60_000 })
      .then((response) => response.json(), () => null).catch(() => null); // The site's answer to Sign in.
    await click(); // Sign in.
    const message = String((await answer)?.msg ?? ''); // e.g. "Please wait 4 minutes 58 seconds before requesting another OTP."
    const wait = /please wait\s*(?:(\d+)\s*minutes?)?\s*(?:(\d+)\s*seconds?)?\s*before requesting another otp/i.exec(message);
    if (!wait || attempt === 4) return; // Accepted (or a different answer the test checks itself).
    const waitMs = (Number(wait[1] ?? 0) * 60 + Number(wait[2] ?? 0) + 5) * 1000; // The time asked for, plus 5 s.
    test.info().annotations.push({ type: 'OTP limit', description: `Sign-in refused: "${message}" Waited ${Math.round(waitMs / 1000)} s and signed in again.` });
    test.info().setTimeout(test.info().timeout + waitMs + 60_000); // Room for the wait and the next try.
    if (await messagePopup(page).isVisible()) await closeMessage(page); // "Please enter a valid username and password." > OK.
    await page.waitForTimeout(waitMs); // Wait until the site sends OTPs again.
  }
}

/** "Send Email OTP" in the "VERIFY USER" dialog this site shows after a correct email and password (SMS or email OTP). */
export const sendEmailOtpButton = (page: Page) => page.locator('[role="dialog"]:visible').getByRole('button', { name: /send email otp/i }).last();

/**
 * Types an OTP into the "VERIFY EMAIL OTP" boxes (one box per digit) and clicks Submit. If the site first asks where to
 * send the OTP ("VERIFY USER": Send SMS OTP / Send Email OTP), chooses Send Email OTP.
 */
export async function submitOtp(page: Page, otp: string) {
  const boxes = otpDialog(page).locator('input:not([type="hidden"])'); // The OTP boxes.
  await expect(boxes.first().or(sendEmailOtpButton(page)).first()).toBeVisible({ timeout: 60_000 }); // OTP boxes or the choice (sign-in can take up to a minute).
  if (!(await boxes.first().isVisible()) && await sendEmailOtpButton(page).isVisible()) await sendEmailOtpButton(page).click(); // VERIFY USER: Send Email OTP (only when no code boxes yet).
  await expect(boxes.first()).toBeVisible({ timeout: 60_000 }); // The OTP boxes.
  // The site can refuse a correct OTP with "Please wait N seconds before requesting another OTP" (its OTP limit,
  // answered by /api/customer/verifyUser): then close the message, wait that long and submit again.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (let index = 0; index < otp.length; index += 1) await boxes.nth(index).fill(otp[index]); // One digit per box.
    const answer = page.waitForResponse((response) => /\/api\/customer\/verifyUser$/i.test(new URL(response.url()).pathname), { timeout: 30_000 })
      .then((response) => response.json(), () => null).catch(() => null); // The site's answer to Submit (if it uses that call).
    await otpDialog(page).getByRole('button', { name: /submit/i }).click(); // Submit.
    const closed = expect(otpDialog(page)).toBeHidden({ timeout: 30_000 }).then(() => null, () => null); // Accepted: the dialog closes.
    const message = String((await Promise.race([answer, closed]))?.msg ?? '');
    const wait = /please wait\s*(?:(\d+)\s*minutes?)?\s*(?:(\d+)\s*seconds?)?\s*before requesting another otp/i.exec(message);
    if (!wait || attempt === 3) return;
    const waitMs = (Number(wait[1] ?? 0) * 60 + Number(wait[2] ?? 0) + 3) * 1000; // The time asked for, plus 3 s.
    test.info().annotations.push({ type: 'OTP limit', description: `OTP refused: "${message}" Waited ${Math.round(waitMs / 1000)} s and submitted again.` });
    test.info().setTimeout(test.info().timeout + waitMs + 60_000); // Room for the wait and the next try.
    if (await messagePopup(page).isVisible()) await closeMessage(page); // The message > OK.
    await page.waitForTimeout(waitMs); // Wait until the site accepts OTPs again.
  }
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

/** The values of the visible boxes on a My Account tab (radio buttons as "name:true/false"). */
export async function visibleFieldValues(page: Page) {
  return page.locator('input:visible').evaluateAll((inputs) => inputs.map((input) => {
    const box = input as HTMLInputElement;
    return box.type === 'radio' || box.type === 'checkbox' ? `${box.name}:${box.checked}` : box.value;
  }));
}

/** Signed in: opens My Account > PROFILE and returns the account's mobile number (the 8 digits after +965). */
export async function readAccountMobile(page: Page) {
  await openMyAccount(page); // My Account.
  await openAccountTab(page, 'PROFILE'); // PROFILE tab.
  const mobile = async () => (await visibleFieldValues(page)).find((value) => /^\d{8}$/.test(value)) ?? ''; // e.g. "99xxxxxx".
  await expect.poll(mobile, { message: 'PROFILE should show the mobile number', timeout: 20_000 }).not.toBe('');
  return mobile();
}

/** Closes the site's message pop-up with OK (it may stay in the page afterwards, but no longer blocks it). */
export async function closeMessage(page: Page) {
  await messagePopup(page).getByRole('button', { name: /^ok$/i }).click(); // Click OK.
}
