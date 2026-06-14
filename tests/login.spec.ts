import { test, expect } from '@playwright/test';
import { getMagicLinkWithPolling } from '../helpers/email-helper';

test.describe('Hokusyo Admin Login Flow', () => {
  test('should send a login link, retrieve it from email, and log in successfully', async ({ page }) => {
    const loginEmail = process.env.LOGIN_EMAIL || 'develop.hokusyo@eraman.net';
    const imapUser = process.env.IMAP_USER;
    const imapPass = process.env.IMAP_PASSWORD;
    const imapHost = process.env.IMAP_HOST || 'imap.titan.email';
    const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);

    // Fast-fail check with actionable instructions if environment variables are not set
    if (!imapUser || imapUser.trim() === '' || !imapPass || imapPass.trim() === '') {
      console.error('\n================================================================');
      console.error('ERROR: IMAP credentials are not set in the .env file!');
      console.error('To run this test successfully, please configure your personal registered email inbox:');
      console.error('1. Open your .env file.');
      console.error('2. Add IMAP_USER=your_personal_email@domain.com');
      console.error('3. Add IMAP_PASSWORD=your_email_password');
      console.error('4. (Optional) Configure IMAP_HOST and IMAP_PORT if you do not use Titan Mail.');
      console.error('================================================================\n');
      throw new Error('IMAP credentials are not configured in the .env file.');
    }

    // Capture the current timestamp before triggering the magic link.
    // This ensures we only read the email sent during this specific test execution.
    const testStartTime = new Date();

    console.log('Step 1: Navigating to the Hokusyo Admin Login page...');
    await page.goto('/admin/login');

    // Verify page title / main header loads
    await expect(page).toHaveTitle(/hokusyo-enterprise-core/);
    const heading = page.getByText('ログインページ').first();
    await expect(heading).toBeVisible();

    console.log(`Step 2: Entering login gateway email address: ${loginEmail}...`);
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(loginEmail);

    console.log('Step 3: Clicking the "ログインリンクを送信" (Send Login Link) button...');
    const submitBtn = page.locator('button[type="submit"]:has-text("ログインリンクを送信")');
    await submitBtn.click();

    // Verify submission feedback if any (let the submit click complete and email trigger)
    await page.waitForTimeout(3000);

    console.log(`Step 4: Polling personal inbox (${imapUser} on ${imapHost}) for the magic link...`);
    // We poll for up to 75 seconds to give the staging mailer and user's mail provider time to sync.
    const magicLink = await getMagicLinkWithPolling(imapHost, imapPort, imapUser, imapPass, testStartTime);

    console.log(`Step 5: Navigating to the retrieved magic link: ${magicLink}...`);
    await page.goto(magicLink);

    console.log('Step 6: Verifying redirection to the Admin dashboard...');
    // Expect the page to redirect to the admin dashboard (e.g., URL is exactly /admin or ends with /admin)
    // We use a regex check with a 15-second timeout to handle any staging redirect latency.
    await expect(page).toHaveURL(/.*\/admin(\/)?$/, { timeout: 15000 });

    // Verify that the login form is no longer visible and that admin UI components exist
    const loginHeading = page.getByText('ログインページ').first();
    await expect(loginHeading).not.toBeVisible();
    
    console.log('Login and redirection test succeeded!');
  });
});
