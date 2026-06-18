import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Read from default .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

test.describe('Hokusyo Dev Login Flow', () => {
  test('should submit the email, extract the magic link from the page, and log in successfully', async ({ page }) => {
    const devLoginEmail = process.env.DEV_LOGIN_EMAIL || 'admin@hokusyo.site';
    const devLoginUrl = 'https://dev.hokusyo.site/admin/login';

    console.log(`Step 1: Navigating to the Hokusyo Dev Login page: ${devLoginUrl}...`);
    await page.goto(devLoginUrl);

    // Verify email input is visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    console.log(`Step 2: Entering login email address: ${devLoginEmail}...`);
    await emailInput.fill(devLoginEmail);

    console.log('Step 3: Clicking the submit button...');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    console.log('Step 4: Waiting for the magic link to appear on the page (SES disabled)...');
    
    // Locate the link inside the yellow box / dev mode alert.
    // The link will have href containing "/admin/login/callback"
    const magicLinkLocator = page.locator('a[href*="/admin/login/callback"]');
    await expect(magicLinkLocator).toBeVisible({ timeout: 15000 });
    
    const magicLink = await magicLinkLocator.getAttribute('href');
    console.log(`Successfully extracted magic link: ${magicLink}`);
    
    if (!magicLink) {
      throw new Error('Failed to retrieve the magic link from the page.');
    }

    console.log('Step 5: Clicking the magic link to log in...');
    // We can either navigate to the extracted link or click the anchor directly.
    // Clicking the anchor or navigating to the href is both fine. Let's navigate to ensure robust load.
    await page.goto(magicLink);

    console.log('Step 6: Verifying redirection to the Admin dashboard...');
    // Expect the page to redirect to the admin dashboard (e.g. url is exactly /admin or ends with /admin)
    await expect(page).toHaveURL(/.*\/admin(\/)?$/, { timeout: 15000 });

    // Verify that the login page elements are gone, confirming successful authentication
    await expect(emailInput).not.toBeVisible();
    
    console.log('Dev Login and redirection test succeeded!');
  });
});
