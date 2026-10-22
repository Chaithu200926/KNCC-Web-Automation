// WEB-48 Live chat opens - one website test case (Web sheet of KNCC-Test-Cases-All-Projects.xlsx).
// The website version of the Android case AND-52 (support chat with the AI agent). No sign-in.
// Seen on UAT (11 Oct 2026): the chat ("Chat with us", the Pair AI agent in a frame from trypair.ai) loads on the
// Contact Us page as an open panel, in Arabic first. In English it shows a consent notice (Terms of Use, Privacy Policy,
// "Agree & Continue"), then a form: Email Id *, Full name, Phone number *, Message *, Start Chat.
// The test sends "hi" with test contact details (an example.com email, "Auto Tester", a 50xxxxxx mobile) - the same as
// AND-52 - and checks the agent's greeting. The boxes are typed key by key: filled in one go the widget ignores the value.
// "Soft" checks (expect.soft) report a problem but let the test carry on.
import { test, expect } from './fixtures'; // Shared setup: testConfig (site address) and step() (step + screenshot).

test.describe.configure({ timeout: 240_000 }); // Up to 4 minutes (the chat frame and the agent's answer are slow).

test('WEB-48 Live chat opens', async ({ page, step, testConfig }, testInfo) => {
  const frame = page.locator('#pair-ai-widget-iframe'); // The chat panel.
  const chat = page.frameLocator('#pair-ai-widget-iframe'); // Its content.
  const chatText = async () => (await chat.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const button = (name: RegExp) => chat.locator('button').filter({ visible: true }).filter({ hasText: name }).first(); // A shown button by its text.
  const startChat = button(/^start chat$/i);

  await step('Open Contact Us and check the chat panel loads', async () => {
    await page.goto(new URL('/contactus', testConfig.urls.home).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(frame, 'The chat panel should load on Contact Us').toBeVisible({ timeout: 60_000 });
    await expect.poll(chatText, { message: 'The chat panel should show its content', timeout: 30_000 }).not.toBe('');
    testInfo.annotations.push({ type: 'chat language at start', description: /[؀-ۿ]{4,}/.test((await chatText()).slice(0, 60)) ? 'Arabic' : 'English' });
  });

  await step('Switch the chat to English and check the consent notice (Terms of Use, Privacy Policy, Powered by)', async () => {
    const toEnglish = button(/^EN$/);
    if (await toEnglish.isVisible().catch(() => false)) await toEnglish.click(); // Arabic first: switch to English.
    await expect(button(/^عربي$/), 'The chat should switch to English (its button now offers Arabic)').toBeVisible({ timeout: 15_000 });
    for (const text of ['Welcome to Cinescape', 'This assistant helps you find films, showtimes and food, and answers your questions.', 'Powered by']) {
      await expect.soft(chat.getByText(text, { exact: false }).first(), `The notice should show "${text}"`).toBeVisible();
    }
    for (const link of ['Terms of Use', 'Privacy Policy']) {
      const anchor = chat.getByRole('link', { name: link }).first();
      await expect.soft(anchor, `The notice should link to ${link}`).toBeVisible();
      testInfo.annotations.push({ type: `${link} link`, description: (await anchor.getAttribute('href').catch(() => null)) ?? 'none' });
    }
  });

  await step('Click Agree & Continue and check the chat form: Email Id, Full name, Phone number, Message', async () => {
    await button(/agree\s*&\s*continue/i).click(); // Accept the notice.
    for (const name of ['emailAddress', 'fullName', 'phoneNumber']) await expect(chat.locator(`input[name="${name}"]`)).toBeVisible();
    await expect(chat.locator('textarea[name="message"]')).toBeVisible();
    await expect(startChat).toBeVisible();
  });

  await step('Click Start Chat with the form empty and check the required-field messages', async () => {
    await startChat.click(); // Nothing filled in.
    for (const message of ['Email Id is required', 'Phone number is required', 'Message is required']) {
      await expect.soft(chat.getByText(message).first(), `An empty form should show "${message}"`).toBeVisible();
    }
    await expect(chat.locator('input[name="emailAddress"]'), 'An empty form must not start a chat').toBeVisible();
  });

  await step('Send "hi" with test contact details and check the agent answers with a greeting and feedback buttons', async () => {
    const stamp = Date.now().toString();
    await chat.locator('input[name="emailAddress"]').pressSequentially(`kncc.autotest.${stamp}@example.com`); // Test email (never receives mail).
    await chat.locator('input[name="fullName"]').pressSequentially('Auto Tester');
    await chat.locator('input[name="phoneNumber"]').pressSequentially(`50${stamp.slice(-6)}`); // The widget accepts 50xxxxxx (as in AND-52).
    await chat.locator('textarea[name="message"]').pressSequentially('hi');
    await startChat.click(); // Start the conversation.
    await expect(chat.locator('input[name="emailAddress"]'), 'The form should close when the chat starts').toBeHidden({ timeout: 30_000 });
    await expect(chat.getByText('hi', { exact: true }).first(), 'The conversation should show the sent "hi"').toBeVisible({ timeout: 30_000 });
    await expect.poll(chatText, { message: 'The AI agent should greet the customer', timeout: 60_000 }).toMatch(/welcome|hello|how can i help/i);
    testInfo.annotations.push({ type: 'agent reply', description: (await chatText()).replace(/^.*?\bhi\b/i, '').slice(0, 160) });
    for (const feedback of ['Thumbs up', 'Thumbs down']) {
      await expect.soft(chat.getByRole('button', { name: feedback }).first(), `The reply should offer "${feedback}" feedback`).toBeVisible();
    }
  });
});
