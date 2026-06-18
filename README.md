# Hokusyo Magic Link Login Automation

This project contains Playwright automation scripts to test the magic link login flow on the Hokusyo staging environment (`https://staging.hokusyo.site/admin/login`) and development environment (`https://dev.hokusyo.site/admin/login`).

## How the Flows Work

### 1. Staging Environment (`tests/login.spec.ts`)
1. The script navigates to the login page and enters the gateway email `develop.hokusyo@eraman.net`.
2. It clicks the **ログインリンクを送信** (Send Login Link) button.
3. The script connects to your personal registered email address's inbox (Hostinger Titan Mail by default) using secure IMAP (`imapflow`).
4. It polls the inbox for emails containing the subject `"ログインリンク"` or `"hokusyo"` received during the test run.
5. Once found, it extracts the magic link from the email, navigates the page to that link, and verifies successful redirection to the `/admin` dashboard.

### 2. Development Environment (`tests/login.dev.spec.ts`)
1. The script navigates to the login page and enters the registered admin email `admin@hokusyo.site`.
2. It clicks the **Send login link** button.
3. Since SES (email sending) is disabled on development, the magic link is rendered directly on the page inside a yellow box.
4. The script extracts the magic link directly from the page DOM (no IMAP connection needed), navigates to it, and verifies successful redirection to the `/admin` dashboard.

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
   - `LOGIN_EMAIL`: The email entered on the staging login form (`develop.hokusyo@eraman.net`).
   - `DEV_LOGIN_EMAIL`: The email entered on the dev login form (`admin@hokusyo.site`).
   - `IMAP_USER`: The personal registered email inbox address where your magic link is routed (e.g., your Titan Mail address).
   - `IMAP_PASSWORD`: The password for your personal registered email inbox.
   - `IMAP_HOST`: The IMAP server host. Defaults to `imap.titan.email` (Hostinger Titan Mail).
   - `IMAP_PORT`: The IMAP server port. Defaults to `993` (SSL).

---

## Running the Tests

To bypass the Windows command shell ampersand path bug (caused by spaces or `&` characters in the directory name), **always run tests using `npm` scripts instead of `npx playwright`**:

| Script | Description |
|---|---|
| `npm test` | Run the staging browser-based magic link login test (headless) |
| `npm run test:headed` | Run the staging browser login test in headed mode |
| `npm run test:api` | Run the staging API-level login tests (no browser needed) |
| `npm run test:dev` | Run the dev browser-based magic link login test (headless) |
| `npm run test:dev:headed` | Run the dev browser login test in headed mode |
| `npm run test:all` | Run all tests (staging, dev, and API) |
| `npm run show-report` | Open the last HTML test report |

---

## Project Structure

```
.
├── tests/
│   ├── login.spec.ts          # Staging browser-based end-to-end test
│   ├── login.dev.spec.ts      # Dev browser-based end-to-end test (directly reads magic link from page)
│   └── login.api.spec.ts      # Staging API-level tests (no browser)
├── helpers/
│   └── email-helper.ts        # IMAP client to poll for magic link emails
├── playwright.config.ts       # Playwright configuration
├── .env                       # Local credentials (not committed to Git)
├── .env.example               # Template for env configuration
└── package.json               # Project scripts and dependencies
```

---

## API Test Cases (`tests/login.api.spec.ts`)

The API tests call the AWS Cognito endpoint directly (no browser required) and cover:

| # | Test | Expected Result |
|---|---|---|
| 1 | `InitiateAuth` with valid email | Cognito returns `200` with `CUSTOM_CHALLENGE` and a `Session` token |
| 2 | `RespondToAuthChallenge` – trigger magic link | Magic link email arrives in inbox, URL contains `/admin/login/callback` |
| 3 | `InitiateAuth` with unregistered email | Cognito returns `200` (user enumeration protection — no account leak) |
| 4 | `InitiateAuth` with empty username | Cognito returns `400 InvalidParameterException` |
| 5 | `InitiateAuth` with invalid Client ID | Cognito returns `400 InvalidParameterException` |
