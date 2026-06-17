import { test, expect, request as playwrightRequest } from '@playwright/test';
import { getMagicLinkWithPolling } from '../helpers/email-helper';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─────────────────────────────────────────────────────────────
// Constants – extracted directly from intercepted browser traffic
// ─────────────────────────────────────────────────────────────
const COGNITO_URL = 'https://cognito-idp.ap-northeast-1.amazonaws.com/';
const COGNITO_CLIENT_ID = '73judurq8n78d3thsc7jgl4t79';
const CALLBACK_URL = 'https://staging.hokusyo.site/admin/login/callback';
const COGNITO_HEADERS = {
  'content-type': 'application/x-amz-json-1.1',
  'cache-control': 'no-store',
};

// ─────────────────────────────────────────────────────────────
// Helper: POST to Cognito
// ─────────────────────────────────────────────────────────────
async function cognitoPost(
  apiContext: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  target: string,
  body: Record<string, unknown>
) {
  return apiContext.post(COGNITO_URL, {
    headers: {
      ...COGNITO_HEADERS,
      'x-amz-target': target,
    },
    data: body,
  });
}

// ─────────────────────────────────────────────────────────────
test.describe('Hokusyo Admin Login - API Flow', () => {
  const loginEmail = process.env.LOGIN_EMAIL || 'develop.hokusyo@eraman.net';
  const imapUser = process.env.IMAP_USER!;
  const imapPass = process.env.IMAP_PASSWORD!;
  const imapHost = process.env.IMAP_HOST || 'imap.titan.email';
  const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);

  test.beforeAll(() => {
    if (!imapUser || !imapPass) {
      throw new Error(
        'IMAP credentials missing. Please configure IMAP_USER and IMAP_PASSWORD in your .env file.'
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: InitiateAuth - Verify Cognito accepts the login request
  // ─────────────────────────────────────────────────────────────
  test('1. InitiateAuth – Cognito returns a valid Session token', async () => {
    const apiContext = await playwrightRequest.newContext();

    const response = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.InitiateAuth',
      {
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: loginEmail },
        ClientId: COGNITO_CLIENT_ID,
      }
    );

    const body = await response.json();
    console.log('InitiateAuth response status:', response.status());
    console.log('InitiateAuth response body:', JSON.stringify(body, null, 2));

    // Cognito should respond with 200 and a CUSTOM_CHALLENGE with a Session token
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('ChallengeName', 'CUSTOM_CHALLENGE');
    expect(body).toHaveProperty('Session');
    expect(typeof body.Session).toBe('string');
    expect(body.Session.length).toBeGreaterThan(10);

    await apiContext.dispose();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: RespondToAuthChallenge - Verify magic link email is triggered
  // ─────────────────────────────────────────────────────────────
  test('2. RespondToAuthChallenge – Magic link email is triggered', async () => {
    const apiContext = await playwrightRequest.newContext();

    // Step A: Get a fresh session token
    const initResponse = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.InitiateAuth',
      {
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: loginEmail },
        ClientId: COGNITO_CLIENT_ID,
      }
    );

    expect(initResponse.status()).toBe(200);
    const initBody = await initResponse.json();
    const session = initBody.Session as string;

    // Step B: Send the challenge response to trigger the magic link email
    const testStartTime = new Date();
    const challengeResponse = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
      {
        ChallengeName: 'CUSTOM_CHALLENGE',
        ChallengeResponses: {
          USERNAME: loginEmail,
          ANSWER: '__dummy__',
        },
        Session: session,
        ClientMetadata: {
          signInMethod: 'MAGIC_LINK',
          redirectUri: CALLBACK_URL,
          alreadyHaveMagicLink: 'no',
        },
        ClientId: COGNITO_CLIENT_ID,
      }
    );

    const challengeBody = await challengeResponse.json();
    console.log('RespondToAuthChallenge status:', challengeResponse.status());
    console.log('RespondToAuthChallenge body:', JSON.stringify(challengeBody, null, 2));

    // Cognito issues another CUSTOM_CHALLENGE round while the magic link email is sent
    expect(challengeResponse.status()).toBe(200);
    expect(challengeBody).toHaveProperty('ChallengeName', 'CUSTOM_CHALLENGE');
    expect(challengeBody).toHaveProperty('Session');

    // Step C: Confirm the magic link email actually arrives in the inbox
    console.log('Polling inbox for magic link email...');
    const magicLink = await getMagicLinkWithPolling(
      imapHost,
      imapPort,
      imapUser,
      imapPass,
      testStartTime
    );

    console.log('Magic link received:', magicLink);
    // The magic link uses a JWT fragment format: /callback#<jwt-token>
    expect(magicLink).toContain('https://staging.hokusyo.site/');
    expect(magicLink).toMatch(/\/admin\/login\/callback[?#]/);

    await apiContext.dispose();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Invalid email – Cognito user enumeration protection
  // ─────────────────────────────────────────────────────────────
  test('3. InitiateAuth – Returns CUSTOM_CHALLENGE even for unregistered email (user enumeration protection)', async () => {
    const apiContext = await playwrightRequest.newContext();

    const response = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.InitiateAuth',
      {
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: 'invalid_user_does_not_exist@invalid-domain-xyz.com' },
        ClientId: COGNITO_CLIENT_ID,
      }
    );

    const body = await response.json();
    console.log('Invalid email response status:', response.status());
    console.log('Invalid email response body:', JSON.stringify(body, null, 2));

    // Cognito intentionally returns 200 even for non-existent users to prevent
    // user enumeration attacks. The response will always be CUSTOM_CHALLENGE.
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('ChallengeName', 'CUSTOM_CHALLENGE');
    expect(body).toHaveProperty('Session');

    await apiContext.dispose();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Empty email – Cognito should reject missing username
  // ─────────────────────────────────────────────────────────────
  test('4. InitiateAuth – Rejects empty username', async () => {
    const apiContext = await playwrightRequest.newContext();

    const response = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.InitiateAuth',
      {
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: '' },
        ClientId: COGNITO_CLIENT_ID,
      }
    );

    const body = await response.json();
    console.log('Empty email response status:', response.status());
    console.log('Empty email response body:', JSON.stringify(body, null, 2));

    // Cognito must reject an empty username with a 400 error
    expect(response.status()).toBe(400);
    expect(body).toHaveProperty('__type');

    await apiContext.dispose();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Invalid Client ID – Cognito should reject bad client
  // ─────────────────────────────────────────────────────────────
  test('5. InitiateAuth – Rejects invalid Cognito Client ID', async () => {
    const apiContext = await playwrightRequest.newContext();

    const response = await cognitoPost(
      apiContext,
      'AWSCognitoIdentityProviderService.InitiateAuth',
      {
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: loginEmail },
        ClientId: 'invalid-client-id-00000000',
      }
    );

    const body = await response.json();
    console.log('Invalid ClientId response status:', response.status());
    console.log('Invalid ClientId response body:', JSON.stringify(body, null, 2));

    // Cognito must return a 400 error for an invalid Client ID
    expect(response.status()).toBe(400);
    expect(body).toHaveProperty('__type');
    expect(body.__type).toMatch(/ResourceNotFoundException|InvalidParameterException/);

    await apiContext.dispose();
  });
});
