import { encodeHeaderValue, utf8ToBase64Url } from './encode';
import type { SendEmailParams, SendResult } from './types';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

interface AuthCtx {
  token: string;
  fromEmail: string;
  fetch: typeof fetch;
}

/**
 * Build a base64url-encoded RFC 2822 message ready for the Gmail send /
 * drafts endpoints.
 *
 * Body is base64-encoded separately (Content-Transfer-Encoding: base64)
 * before the whole message is base64url-encoded again. This keeps the
 * outer encoding ASCII-safe and side-steps every UTF-8-in-btoa pitfall.
 */
export function buildRawEmail(params: SendEmailParams, fromEmail: string): string {
  const toList = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  const contentType = params.isHtml ? 'text/html' : 'text/plain';

  const headers: string[] = [
    `From: ${fromEmail}`,
    `To: ${toList}`,
    `Subject: ${encodeHeaderValue(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset=utf-8`,
    'Content-Transfer-Encoding: base64',
  ];

  if (params.cc) {
    headers.push(`Cc: ${Array.isArray(params.cc) ? params.cc.join(', ') : params.cc}`);
  }
  if (params.bcc) {
    headers.push(`Bcc: ${Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc}`);
  }
  if (params.replyTo) {
    headers.push(`Reply-To: ${params.replyTo}`);
  }
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }

  // Body: base64-encode UTF-8 bytes (NOT base64url here — the inner
  // encoding for Content-Transfer-Encoding: base64 is standard base64).
  const bodyBytes = new TextEncoder().encode(params.body);
  let bodyBinary = '';
  for (let i = 0; i < bodyBytes.length; i++) {
    bodyBinary += String.fromCharCode(bodyBytes[i] as number);
  }
  const bodyBase64 = btoa(bodyBinary);

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${bodyBase64}`;

  // Outer encoding is base64url. The whole rawMessage is now ASCII-safe
  // (headers are RFC 2047, body is base64), so we can use utf8ToBase64Url
  // safely — though plain btoa would also work here.
  return utf8ToBase64Url(rawMessage);
}

export async function sendEmail(ctx: AuthCtx, params: SendEmailParams): Promise<SendResult> {
  try {
    const raw = buildRawEmail(params, ctx.fromEmail);

    const res = await ctx.fetch(`${GMAIL_API}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw,
        ...(params.threadId ? { threadId: params.threadId } : {}),
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Gmail send failed (${res.status}): ${await res.text()}` };
    }

    const data = (await res.json()) as { id: string; threadId: string; labelIds: string[] };
    return {
      success: true,
      messageId: data.id,
      threadId: data.threadId,
      labelIds: data.labelIds,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createDraft(ctx: AuthCtx, params: SendEmailParams): Promise<SendResult> {
  try {
    const raw = buildRawEmail(params, ctx.fromEmail);

    const res = await ctx.fetch(`${GMAIL_API}/users/me/drafts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!res.ok) {
      return { success: false, error: `Gmail draft failed (${res.status}): ${await res.text()}` };
    }

    const data = (await res.json()) as {
      id: string;
      message: { id: string; threadId: string };
    };
    return {
      success: true,
      messageId: data.id,
      threadId: data.message?.threadId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
