/**
 * Cloudflare Workers + KV-backed token cache.
 *
 * Bind a KV namespace to your Worker and pass it to the cache. Tokens
 * survive across isolate boundaries and avoid extra OAuth refreshes.
 */

import { GmailClient, type TokenCache } from '@logos-flux/gmail-edge';

interface Env {
  GMAIL_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
}

class WorkersKVTokenCache implements TokenCache {
  constructor(
    private kv: KVNamespace,
    private key = 'gmail:access_token',
  ) {}

  async get() {
    return this.kv.get(this.key);
  }

  async set(token: string, expiresAt: number) {
    const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000) - 60);
    await this.kv.put(this.key, token, { expirationTtl: ttl });
  }
}

export default {
  async fetch(_req: Request, env: Env): Promise<Response> {
    const gmail = new GmailClient({
      credentials: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        refreshToken: env.GOOGLE_REFRESH_TOKEN,
      },
      tokenCache: new WorkersKVTokenCache(env.GMAIL_KV),
    });

    const result = await gmail.send({
      to: 'recipient@example.com',
      subject: 'Hello from a Worker',
      body: 'Sent without googleapis.',
    });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
