/**
 * Public types for gmail-edge.
 *
 * Kept deliberately minimal — the shape Gmail returns is large; we only
 * model what the operations in this package actually need or return.
 */

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Pluggable token cache. Default implementation is in-memory, scoped to
 * the JS isolate. Provide your own to share across processes (Redis,
 * Postgres, Workers KV, SQLite, etc.).
 *
 * `get` returns the access token string if still valid, or null.
 * `set` is called with the access token and the absolute expiry timestamp
 * (ms since epoch). Implementations MAY ignore `expiresAt` if they have
 * their own TTL mechanism.
 */
export interface TokenCache {
  get(): Promise<string | null>;
  set(token: string, expiresAt: number): Promise<void>;
}

export interface ClientOptions {
  credentials: OAuthCredentials;
  /** Optional pluggable token cache. Defaults to in-memory. */
  tokenCache?: TokenCache;
  /** Optional fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  /** RFC 822 message ID being replied to. Sets In-Reply-To and References. */
  inReplyTo?: string;
  /** Gmail thread ID. Required to keep replies threaded. */
  threadId?: string;
  /** Treat body as HTML. Defaults to plain text. */
  isHtml?: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  labelIds?: string[];
  error?: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailBody {
  size: number;
  data?: string;
  attachmentId?: string;
}

export interface GmailPart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailBody;
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailPart;
  sizeEstimate: number;
}

export interface ListMessagesOptions {
  /** Gmail search query, e.g. `is:unread in:inbox`. */
  q?: string;
  maxResults?: number;
  labelIds?: string[];
  pageToken?: string;
}

export interface ListMessagesResult {
  ids: string[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface HistorySyncOptions {
  startHistoryId: string;
  /** Defaults to ['messageAdded']. */
  historyTypes?: Array<'messageAdded' | 'messageDeleted' | 'labelAdded' | 'labelRemoved'>;
  maxResults?: number;
}

export interface HistorySyncResult {
  /** New message IDs (deduplicated). */
  messageIds: string[];
  /** Updated history ID to persist for the next sync. */
  historyId: string;
  /**
   * True if the history cursor was too old and Gmail returned 404.
   * Caller should fall back to listMessages and re-establish the cursor
   * from getProfile().historyId.
   */
  expired: boolean;
}

export interface UserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}
