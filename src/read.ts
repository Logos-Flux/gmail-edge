import type {
  GmailMessage,
  HistorySyncOptions,
  HistorySyncResult,
  ListMessagesOptions,
  ListMessagesResult,
  UserProfile,
} from './types';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

interface AuthCtx {
  token: string;
  fetch: typeof fetch;
}

export async function getProfile(ctx: AuthCtx): Promise<UserProfile> {
  const res = await ctx.fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail getProfile failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as UserProfile;
}

export async function listMessages(
  ctx: AuthCtx,
  opts: ListMessagesOptions = {},
): Promise<ListMessagesResult> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.maxResults) params.set('maxResults', String(opts.maxResults));
  if (opts.pageToken) params.set('pageToken', opts.pageToken);
  for (const id of opts.labelIds ?? []) params.append('labelIds', id);

  const res = await ctx.fetch(`${GMAIL_API}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail listMessages failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    messages?: { id: string }[];
    nextPageToken?: string;
    resultSizeEstimate: number;
  };
  return {
    ids: (data.messages ?? []).map((m) => m.id),
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate,
  };
}

export async function getMessage(ctx: AuthCtx, id: string): Promise<GmailMessage> {
  const res = await ctx.fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail getMessage(${id}) failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as GmailMessage;
}

/**
 * Fetch many messages in parallel. Failures are collected and surfaced
 * via the second tuple element so partial success is observable.
 */
export async function getMessages(
  ctx: AuthCtx,
  ids: string[],
  concurrency = 10,
): Promise<[GmailMessage[], { id: string; error: string }[]]> {
  const messages: GmailMessage[] = [];
  const errors: { id: string; error: string }[] = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((id) => getMessage(ctx, id)));
    results.forEach((r, idx) => {
      const id = batch[idx] as string;
      if (r.status === 'fulfilled') {
        messages.push(r.value);
      } else {
        errors.push({ id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      }
    });
  }

  return [messages, errors];
}

/**
 * Incremental sync via the history API.
 *
 * If the cursor (`startHistoryId`) is too old, Gmail returns 404 — we
 * surface this as `expired: true` so the caller can fall back to
 * listMessages and re-establish a fresh cursor from getProfile().
 */
export async function syncHistory(
  ctx: AuthCtx,
  opts: HistorySyncOptions,
): Promise<HistorySyncResult> {
  const params = new URLSearchParams({
    startHistoryId: opts.startHistoryId,
    maxResults: String(opts.maxResults ?? 100),
  });
  for (const t of opts.historyTypes ?? ['messageAdded']) {
    params.append('historyTypes', t);
  }

  const res = await ctx.fetch(`${GMAIL_API}/users/me/history?${params}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });

  if (res.status === 404) {
    // Cursor too old. Caller should fall back to listMessages and reset
    // cursor from getProfile().historyId.
    return { messageIds: [], historyId: opts.startHistoryId, expired: true };
  }

  if (!res.ok) {
    throw new Error(`Gmail syncHistory failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    history?: { messagesAdded?: { message: { id: string } }[] }[];
    historyId: string;
  };

  const ids = new Set<string>();
  for (const h of data.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      ids.add(m.message.id);
    }
  }

  return {
    messageIds: [...ids],
    historyId: data.historyId,
    expired: false,
  };
}
