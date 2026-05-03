/**
 * Encoding helpers for the Gmail API.
 *
 * Gmail's send endpoint expects a base64url-encoded RFC 2822 message.
 * Two things commonly trip people up:
 *
 *   1. Subject headers with non-ASCII characters need RFC 2047 encoding.
 *   2. btoa() only accepts Latin-1; multi-byte UTF-8 must be converted
 *      via TextEncoder first.
 *
 * These helpers handle both.
 */

/**
 * Encode arbitrary text to base64url (RFC 4648 §5), UTF-8 safe.
 *
 * Use this for the message body when Content-Transfer-Encoding is base64,
 * and for the final encoding of the entire raw RFC 2822 message before
 * sending to Gmail.
 */
export function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url-encoded UTF-8 string. Used to extract message bodies
 * returned by the Gmail messages.get endpoint.
 */
export function base64UrlToUtf8(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encode a header value per RFC 2047 if it contains non-ASCII characters.
 * Pure-ASCII values are returned unchanged.
 *
 * Gmail will otherwise reject headers like `Subject: Café ☕` with a
 * cryptic 400.
 */
export function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/**
 * Strip HTML tags. Crude but adequate for plain-text fallback when a
 * message has no text/plain part. Preserves paragraph breaks and basic
 * entity decoding.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
