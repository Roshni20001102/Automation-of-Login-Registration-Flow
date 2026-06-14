import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Read from default .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Serial runs are safer when testing mailboxes to prevent message collisions
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker to avoid reading overlapping emails
  reporter: 'html',
  use: {
    baseURL: 'https://staging.hokusyo.site',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },
  timeout: 90000, // 90 seconds timeout for tests (waiting for emails can take time)
  expect: {
    timeout: 15000, // 15 seconds expect timeout
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
