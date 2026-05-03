/**
 * gmail-edge — dependency-free Gmail API client for edge runtimes.
 *
 * Public exports. Tree-shakeable; import only what you need.
 */

export { GmailClient } from './client';

export {
  MemoryTokenCache,
  getAccessToken,
  refreshAccessToken,
} from './auth';

export {
  buildRawEmail,
  sendEmail,
  createDraft,
} from './send';

export {
  getMessage,
  getMessages,
  getProfile,
  listMessages,
  syncHistory,
} from './read';

export {
  getBody,
  getHeader,
  findPart,
} from './parse';

export {
  base64UrlToUtf8,
  encodeHeaderValue,
  stripHtml,
  utf8ToBase64Url,
} from './encode';

export type {
  ClientOptions,
  GmailBody,
  GmailHeader,
  GmailMessage,
  GmailPart,
  HistorySyncOptions,
  HistorySyncResult,
  ListMessagesOptions,
  ListMessagesResult,
  OAuthCredentials,
  SendEmailParams,
  SendResult,
  TokenCache,
  UserProfile,
} from './types';
