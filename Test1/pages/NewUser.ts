// New test users for the sign-up and password test cases (WEB-05, WEB-09, WEB-13). Every run registers its own new
// user with a unique email at example.com (a reserved domain that never receives mail), so the provided test accounts
// are never changed. On UAT the email OTP and the mobile OTP are always 111111 (testConfig.newUserOtp).
// Flows seen on UAT (1 Oct 2026):
// - SIGN UP > Save > message "Please enter the OTP sent to your mobile number and email" > "ENTER OTP RECEIVED ON EMAIL &
//   MOBILE" (6 boxes for the email OTP, 6 for the mobile OTP) > Submit OTP > signed in.
// - Forgot Password? > FORGOT PASSWORD (email) > Continue > one dialog with the 6 OTP boxes and the new password twice >
//   Reset Password > message "Passwords changed succefully" > SIGN IN.
// - My Account > PROFILE > Edit Password > "Change Password" (Old / New / Confirm Password) > Proceed.
import { expect, Locator, Page } from '@playwright/test'; // Playwright's checks and types.
import { openSignInDialog, signInDialog } from './Account'; // The SIGN IN dialog.
import { openMessage } from './Booking'; // The site's open message pop-up.
import { openHome } from './WebSite'; // Opens the homepage.

/** The details typed for a new user. */
export interface NewUser {
  firstName: string;
  lastName: string;
  email: string; // Unique for each run, e.g. "kncc.autotest.1759302123456@example.com".
  password: string;
  mobile: string; // 8 digits after +965, unique for each run.
  dateOfBirth: string; // Typed as DD-MM-YYYY; the site shows it as YYYY-MM-DD.
  gender: 'Male' | 'Female';
}

/** A new user's details: a unique email and mobile number from the current time. */
export function newTestUser(): NewUser {
  const stamp = Date.now().toString(); // Milliseconds: different on every run.
  return {
    firstName: 'Auto',
    lastName: 'Tester',
    email: `kncc.autotest.${stamp}@example.com`,
    password: 'Auto@Kncc2026',
    mobile: `5${stamp.slice(-7)}`, // A Kuwait mobile format (8 digits).
    dateOfBirth: '01-01-1995',
    gender: 'Male',
  };
}

/** The SIGN UP dialog. */
export const signUpDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ has: page.locator('input[name="firstname"]') }).last();

/** The dialog for the sign-up OTPs ("ENTER OTP RECEIVED ON EMAIL & MOBILE"). */
export const signUpOtpDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: /enter otp received on email\s*&\s*mobile/i }).last();

/** The FORGOT PASSWORD dialog (email and Continue). */
export const forgotPasswordDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ has: page.locator('input[name="userName"]') }).last();

/** The password reset dialog ("ENTER OTP RECEIVED ON EMAIL": 6 OTP boxes, new password twice, Reset Password). */
export const resetPasswordDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: /reset password/i }).last();

/** The "Change Password" dialog in My Account (Old / New / Confirm Password, Proceed). */
export const changePasswordDialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: /change password/i }).last();

/** Types a 6-digit OTP into six one-character boxes. */
export async function typeOtp(boxes: Locator, otp: string) {
  await expect(boxes).toHaveCount(otp.length); // One box per digit.
  for (let index = 0; index < otp.length; index += 1) await boxes.nth(index).fill(otp[index]); // One digit per box.
}

/** Opens SIGN UP from the profile icon ("Not Registered? SIGN UP"). */
export async function openSignUp(page: Page) {
  await openSignInDialog(page); // Profile icon > SIGN IN.
  await signInDialog(page).getByText(/^sign up$/i).click(); // "Not Registered? SIGN UP".
  await expect(signUpDialog(page)).toBeVisible(); // The SIGN UP form.
}

/** Fills the SIGN UP form with a new user's details (the promotion options keep their default "Yes"). */
export async function fillSignUp(page: Page, user: NewUser) {
  const form = signUpDialog(page);
  await form.locator('input[name="firstname"]').fill(user.firstName); // Name.
  await form.locator('input[name="lastname"]').fill(user.lastName); // Last Name.
  await form.locator('input[type="email"]').fill(user.email); // Email.
  await form.locator('input[name="password"]').fill(user.password); // Password.
  await form.locator('input[name="con-password"]').fill(user.password); // Confirm Password.
  await form.locator('input[name="mobile"]').fill(user.mobile); // Mobile (+965 is preselected).
  const dateOfBirth = form.locator('.react-datepicker__input-container input'); // Date of Birth (a date picker).
  await dateOfBirth.fill(user.dateOfBirth); // Typed as DD-MM-YYYY; the calendar opens on that day.
  await form.locator('.react-datepicker__day--selected').click(); // Click the highlighted day: the calendar closes.
  await expect(dateOfBirth).toHaveValue(user.dateOfBirth.split('-').reverse().join('-')); // e.g. "1995-01-01".
  const gender = form.locator('label').filter({ hasText: new RegExp(`^${user.gender}$`) }); // Gender (radio inside its label).
  await gender.click();
  await expect(gender.locator('input[type="radio"]')).toBeChecked();
}

/** In "ENTER OTP RECEIVED ON EMAIL & MOBILE": enters the email and mobile OTPs and submits; waits until signed in. */
export async function confirmSignUp(page: Page, otp: string) {
  const dialog = signUpOtpDialog(page);
  await typeOtp(dialog.locator('.otp_login').filter({ hasText: /email otp/i }).locator('input'), otp); // Email OTP.
  await typeOtp(dialog.locator('.otp_login').filter({ hasText: /mobile otp/i }).locator('input'), otp); // Mobile OTP.
  await dialog.getByRole('button', { name: /submit otp/i }).click(); // Submit OTP.
  await expect(dialog).toBeHidden({ timeout: 30_000 }); // The dialog closes.
  await expect(page.locator('a[href="/myaccount"]').first()).toBeAttached({ timeout: 30_000 }); // Signed in.
}

/** Registers a new user from the homepage (SIGN UP, Save, OTPs); the user ends up signed in. */
export async function registerNewUser(page: Page, baseUrl: string, user: NewUser, otp: string) {
  await openHome(page, baseUrl); // Homepage.
  await openSignUp(page); // Profile icon > SIGN IN > SIGN UP.
  await fillSignUp(page, user); // The form.
  await signUpDialog(page).getByRole('button', { name: /^save$/i }).click(); // Save.
  await expect(openMessage(page)).toContainText(/OTP sent/i, { timeout: 30_000 }); // "Please enter the OTP sent to ...".
  await openMessage(page).getByRole('button', { name: /^ok$/i }).click(); // OK.
  await confirmSignUp(page, otp); // Email and mobile OTPs; signed in.
}

/** Opens Forgot Password? from SIGN IN, enters the email and clicks Continue. */
export async function startForgotPassword(page: Page, email: string) {
  await openSignInDialog(page); // Profile icon > SIGN IN.
  await signInDialog(page).getByText(/forgot password/i).click(); // "Forgot Password?".
  const dialog = forgotPasswordDialog(page);
  await dialog.locator('input[name="userName"]').fill(email); // Email.
  await dialog.getByRole('button', { name: /^continue$/i }).click(); // Continue.
}

/** In the reset dialog: enters the OTP and the new password twice, then clicks Reset Password. */
export async function resetPassword(page: Page, otp: string, newPassword: string) {
  const dialog = resetPasswordDialog(page);
  await typeOtp(dialog.locator('input[maxlength="1"]'), otp); // The emailed OTP.
  const passwords = dialog.locator('input[type="password"]'); // New password and its confirmation.
  await expect(passwords).toHaveCount(2);
  await passwords.nth(0).fill(newPassword);
  await passwords.nth(1).fill(newPassword);
  await dialog.getByRole('button', { name: /reset password/i }).click(); // Reset Password.
}

/** In My Account > PROFILE: opens "Change Password" with the Edit Password button. */
export async function openChangePassword(page: Page) {
  await page.locator('.edit-password button').filter({ visible: true }).first().click(); // Edit Password.
  await expect(changePasswordDialog(page)).toBeVisible(); // Change Password.
}

/** In "Change Password": types the old, new and confirmation passwords and clicks Proceed. */
export async function submitChangePassword(page: Page, oldPassword: string, newPassword: string, confirmation = newPassword) {
  const dialog = changePasswordDialog(page);
  await dialog.getByPlaceholder('Old Password').fill(oldPassword); // Old Password.
  await dialog.getByPlaceholder('New Password').fill(newPassword); // New Password.
  await dialog.getByPlaceholder('Confirm Password').fill(confirmation); // Confirm Password.
  await dialog.getByRole('button', { name: /proceed/i }).click(); // Proceed.
}
