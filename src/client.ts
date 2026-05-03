import { MemoryTokenCache, getAccessToken } from './auth';
import { getMessage, getMessages, getProfile, listMessages, syncHistory } from './read';
import { createDraft, sendEmail } from './send';
import type {
  ClientOptions,
  GmailMessage,
  HistorySyncOptions,
  HistorySyncResult,
  ListMessagesOptions,
  ListMessagesResult,
  SendEmailParams,
  SendResult,
  TokenCache,
  UserProfile,
} from './types';

/**
 * High-level Gmail API client.
 *
 *   const gmail = new GmailClient({
 *     credentials: {
 *       clientId: env.GOOGLE_CLIENT_ID,
 *       clientSecret: env.GOOGLE_CLIENT_SECRET,
 *       refreshToken: env.GOOGLE_REFRESH_TOKEN,
 *     },
 *   });
 *
 *   const result = await gmail.send({ to: 'a@b.c', subject: 'hi', body: '...' });
 *
 * Token caching defaults to in-memory (per JS isolate). For shared caches
 * (Workers KV, Redis, SQLite, Postgres), pass a custom TokenCache.
 */
export class GmailClient {
  private readonly tokenCache: TokenCache;
  private readonly fetchImpl: typeof fetch;
  private readonly credentials: ClientOptions['credentials'];
  private cachedFromEmail: string | null = null;

  constructor(opts: ClientOptions) {
    this.credentials = opts.credentials;
    this.tokenCache = opts.tokenCache ?? new MemoryTokenCache();
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** Force-refresh the user's email address (cached for the client lifetime). */
  async getFromEmail(): Promise<string> {
    if (this.cachedFromEmail) return this.cachedFromEmail;
    const profile = await this.getProfile();
    this.cachedFromEmail = profile.emailAddress;
    return this.cachedFromEmail;
  }

  private async authCtx() {
    const token = await getAccessToken({
      credentials: this.credentials,
      tokenCache: this.tokenCache,
      fetch: this.fetchImpl,
    });
    return { token, fetch: this.fetchImpl };
  }

  private async sendCtx() {
    const ctx = await this.authCtx();
    const fromEmail = await this.getFromEmail();
    return { ...ctx, fromEmail };
  }

  // ---- read ----

  async getProfile(): Promise<UserProfile> {
    return getProfile(await this.authCtx());
  }

  async listMessages(opts?: ListMessagesOptions): Promise<ListMessagesResult> {
    return listMessages(await this.authCtx(), opts);
  }

  async getMessage(id: string): Promise<GmailMessage> {
    return getMessage(await this.authCtx(), id);
  }

  async getMessages(
    ids: string[],
    concurrency?: number,
  ): Promise<[GmailMessage[], { id: string; error: string }[]]> {
    return getMessages(await this.authCtx(), ids, concurrency);
  }

  async syncHistory(opts: HistorySyncOptions): Promise<HistorySyncResult> {
    return syncHistory(await this.authCtx(), opts);
  }

  // ---- write ----

  async send(params: SendEmailParams): Promise<SendResult> {
    return sendEmail(await this.sendCtx(), params);
  }

  async draft(params: SendEmailParams): Promise<SendResult> {
    return createDraft(await this.sendCtx(), params);
  }

  /**
   * Convenience wrapper for replying within an existing thread. Sets
   * threadId, In-Reply-To, and References from a single source.
   */
  async reply(
    params: SendEmailParams & { inReplyTo: string; threadId: string },
  ): Promise<SendResult> {
    return this.send(params);
  }
}
