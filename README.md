# Hokusyo Magic Link Login Automation

This project contains Playwright automation scripts to test the magic link login flow on the Hokusyo staging environment (`https://staging.hokusyo.site/admin/login`).

## How the Flow Works
1. The script navigates to the login page and enters the gateway email `develop.hokusyo@eraman.net`.
2. It clicks the **ログインリンクを送信** (Send Login Link) button.
3. The script connects to your personal registered email address's inbox (Hostinger Titan Mail by default) using secure IMAP (`imapflow`).
4. It polls the inbox for emails containing the subject `"ログインリンク"` or `"hokusyo"` received during the test run.
5. Once found, it extracts the magic link from the email, navigates the page to that link, and verifies successful redirection to the `/admin` dashboard.

---

## Installation

Install the Node.js dependencies:
```bash
npm install
```

---

## Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Open the **`.env`** file and configure your credentials:
   - `LOGIN_EMAIL`: The email entered on the web login form (`develop.hokusyo@eraman.net`).
   - `IMAP_USER`: The personal registered email inbox address where your magic link is routed (e.g., your Titan Mail address).
   - `IMAP_PASSWORD`: The password for your personal registered email inbox.
   - `IMAP_HOST`: The IMAP server host. Defaults to `imap.titan.email` (Hostinger Titan Mail).
   - `IMAP_PORT`: The IMAP server port. Defaults to `993` (SSL).

---

## Running the Tests

To bypass the Windows command shell ampersand path bug (caused by spaces or `&` characters in the directory name), **always run tests using `npm` scripts instead of `npx playwright`**:

* **Run tests in Headless mode:**
  ```bash
  npm test
  ```
* **Run tests in Headed mode (opens a browser window to watch execution):**
  ```bash
  npm run test:headed
  ```
* **Open the last HTML Test Report:**
  ```bash
  npm run show-report
  ```

---

## Project Structure
* **`tests/login.spec.ts`**: The main login test flow.
* **`helpers/email-helper.ts`**: The IMAP client that logs in and polls for the magic link.
* **`playwright.config.ts`**: Playwright test engine settings (increased timeout to 90 seconds to allow for email delivery).
* **`.env`**: Local credentials configuration (ignored by Git).
