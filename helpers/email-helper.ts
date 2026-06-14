import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Connects to IMAP and retrieves the magic login link sent to the user email.
 * @param imapHost The IMAP host (e.g. imap.gmail.com)
 * @param imapPort The IMAP port (e.g. 993)
 * @param emailUser The personal email username (e.g. user@domain.com)
 * @param emailPass The email password (App Password)
 * @param sinceTime The date-time when the test started (to filter old emails)
 */
export async function fetchMagicLink(
  imapHost: string,
  imapPort: number,
  emailUser: string,
  emailPass: string,
  sinceTime: Date
): Promise<string> {
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    logger: false, // Turn off verbose logs
  });

  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Search all messages in INBOX.
      // Search by day-level granularity first, then filter by exact timestamp locally.
      const today = new Date(sinceTime.getFullYear(), sinceTime.getMonth(), sinceTime.getDate());
      const messages = await client.search({
        since: today,
      });

      console.log(`Found ${messages.length} messages received today. Filtering for login link...`);

      // Search from newest to oldest
      for (let i = messages.length - 1; i >= 0; i--) {
        const seq = messages[i];
        const message = await client.fetchOne(seq, { envelope: true, source: true });
        
        const date = message.envelope.date;
        const subject = message.envelope.subject || '';
        
        // Local timestamp check
        if (date && date.getTime() >= sinceTime.getTime() - 10000) { // allow 10s clock drift buffer
          // Parse sender and subject to confirm it's from Hokusyo
          const isFromHokusyo = 
            subject.toLowerCase().includes('hokusyo') || 
            subject.includes('ログイン') || 
            (message.envelope.from && message.envelope.from.some(f => f.address && f.address.includes('hokusyo')));
          
          if (isFromHokusyo) {
            console.log(`Analyzing matching email: "${subject}" received at ${date.toISOString()}`);
            const parsed = await simpleParser(message.source);
            const text = parsed.text || '';
            const html = parsed.html || '';
            const content = text + '\n' + html;

            // Look for magic link URL pointing to Hokusyo admin/login redirection
            const urlRegex = /https:\/\/staging\.hokusyo\.site\/[^\s"'<>]+/g;
            const links = content.match(urlRegex);

            if (links && links.length > 0) {
              let magicLink = links[0];
              // Clean up any trailing punctuation typical in text emails
              magicLink = magicLink.replace(/[.,;)]+$/, '');
              return magicLink;
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  throw new Error('Magic link email not found in recent messages');
}

/**
 * Polls the inbox every few seconds for the magic link email.
 */
export async function getMagicLinkWithPolling(
  imapHost: string,
  imapPort: number,
  emailUser: string,
  emailPass: string,
  sinceTime: Date,
  timeoutMs: number = 75000,
  intervalMs: number = 5000
): Promise<string> {
  const startTime = Date.now();
  console.log(`Starting polling for magic link email at ${sinceTime.toISOString()} on ${imapHost}...`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const link = await fetchMagicLink(imapHost, imapPort, emailUser, emailPass, sinceTime);
      if (link) {
        return link;
      }
    } catch (e: any) {
      console.log(`Polling status: ${e.message || e}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Failed to retrieve magic link email within ${timeoutMs / 1000} seconds.`);
}
