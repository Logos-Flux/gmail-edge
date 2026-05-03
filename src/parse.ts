import { base64UrlToUtf8, stripHtml } from './encode';
import type { GmailMessage, GmailPart } from './types';

/**
 * Look up a header by name (case-insensitive). Returns empty string if absent.
 */
export function getHeader(msg: GmailMessage, name: string): string {
  const lower = name.toLowerCase();
  const h = msg.payload.headers?.find((h) => h.name.toLowerCase() === lower);
  return h?.value ?? '';
}

/**
 * Extract the best plain-text body from a Gmail message.
 *
 * Preference order:
 *   1. text/plain part anywhere in the MIME tree
 *   2. text/html part, with tags stripped
 *   3. single-part body
 *   4. snippet fallback
 */
export function getBody(msg: GmailMessage): string {
  const parts = msg.payload.parts ?? [];

  const plain = findPart(parts, 'text/plain');
  if (plain) return base64UrlToUtf8(plain);

  const html = findPart(parts, 'text/html');
  if (html) return stripHtml(base64UrlToUtf8(html));

  if (msg.payload.body?.data) {
    if (msg.payload.mimeType === 'text/html') {
      return stripHtml(base64UrlToUtf8(msg.payload.body.data));
    }
    return base64UrlToUtf8(msg.payload.body.data);
  }

  return msg.snippet ?? '';
}

/**
 * Recursively find the first part matching a MIME type and return its
 * raw base64url-encoded body data (or null).
 */
export function findPart(parts: GmailPart[], mimeType: string): string | null {
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return part.body.data;
    }
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}
