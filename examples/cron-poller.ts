/**
 * Long-running poller using the history API.
 *
 * Suitable for any container or VM (Bun, Node, Deno). For Workers, replace
 * setInterval with a scheduled handler.
 */

import { GmailClient, getBody, getHeader } from '@logos-flux/gmail-edge';

const gmail = new GmailClient({
  credentials: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  },
});

let historyId: string;

async function bootstrap() {
  const profile = await gmail.getProfile();
  historyId = profile.historyId;
  console.log(`Bootstrapped at historyId=${historyId} for ${profile.emailAddress}`);
}

async function poll() {
  const result = await gmail.syncHistory({ startHistoryId: historyId });

  if (result.expired) {
    console.log('History cursor expired; re-bootstrapping');
    await bootstrap();
    return;
  }

  if (result.messageIds.length > 0) {
    const [messages, errors] = await gmail.getMessages(result.messageIds);
    for (const msg of messages) {
      console.log(
        `[${msg.id}] from=${getHeader(msg, 'From')} subject=${getHeader(msg, 'Subject')}`,
      );
      console.log(getBody(msg).slice(0, 200));
    }
    for (const err of errors) {
      console.error(`failed to fetch ${err.id}: ${err.error}`);
    }
  }

  historyId = result.historyId;
}

await bootstrap();
setInterval(poll, 5 * 60_000);
