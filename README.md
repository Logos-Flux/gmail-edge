# gmail-edge

Dependency-free Gmail API client for edge runtimes.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@logos-flux/gmail-edge.svg)](https://www.npmjs.com/package/@logos-flux/gmail-edge)

> **Status:** maintained for our own edge-runtime Gmail integrations. Stable for the documented surface; PRs welcome, support not promised.

## Why

The official `googleapis` SDK is large, Node-only, and pulls in dozens of transitive dependencies. That makes it a poor fit for Cloudflare Workers, Bun, Deno, and other `fetch`-based runtimes.

`gmail-edge` is a small, focused alternative:

- **Zero runtime dependencies.** Uses standard `fetch`, `TextEncoder`, `btoa`, `atob` — nothing else.
- **Runtime-agnostic.** Workers, Bun, Node ≥18, Deno, browsers — anywhere `fetch` lives.
- **Correct UTF-8 handling.** RFC 2047 Subject encoding and proper UTF-8-to-base64url everywhere — emojis, CJK, accented characters all work.
- **Pluggable token cache.** In-memory by default; swap in Workers KV, Redis, SQLite, Postgres, or anything else via a tiny interface.
- **Read and write.** Send, draft, reply, list, get, history sync, profile, body extraction.
- **TypeScript-first.** Strict types, full IDE autocomplete, dual ESM/CJS build.

## Install

```bash
npm install @logos-flux/gmail-edge
# or
bun add @logos-flux/gmail-edge
```

## Quick start

```ts
import { GmailClient } from '@logos-flux/gmail-edge';

const gmail = new GmailClient({
  credentials: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  },
});

// Send
const result = await gmail.send({
  to: 'someone@example.com',
  subject: 'Hello from the edge ☕',
  body: 'This message was sent without googleapis.',
});

// Read
const profile = await gmail.getProfile();
const { ids } = await gmail.listMessages({ q: 'is:unread', maxResults: 10 });
const msg = await gmail.getMessage(ids[0]);
```

## Token caching

Default cache lives in-memory and is scoped to the JS isolate. For shared caches across processes — Workers KV, Redis, SQLite, Postgres — implement the `TokenCache` interface:

```ts
import type { TokenCache } from '@logos-flux/gmail-edge';

class KVTokenCache implements TokenCache {
  constructor(private kv: KVNamespace) {}

  async get() {
    return this.kv.get('gmail:access_token');
  }

  async set(token: string, expiresAt: number) {
    const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000) - 60);
    await this.kv.put('gmail:access_token', token, { expirationTtl: ttl });
  }
}

const gmail = new GmailClient({
  credentials: { /* ... */ },
  tokenCache: new KVTokenCache(env.MY_KV),
});
```

See [`examples/`](./examples/) for KV, Redis, and SQLite implementations.

## Reading messages

```ts
// One-shot list
const { ids, nextPageToken } = await gmail.listMessages({
  q: 'in:inbox newer_than:1d',
  maxResults: 50,
});

// Fetch many in parallel (returns successes and failures separately)
const [messages, errors] = await gmail.getMessages(ids, 10);

// Extract a plain-text body and headers
import { getBody, getHeader } from '@logos-flux/gmail-edge';
for (const msg of messages) {
  console.log(getHeader(msg, 'From'), getHeader(msg, 'Subject'));
  console.log(getBody(msg));
}
```

## Incremental sync (history API)

```ts
let { historyId } = await gmail.getProfile(); // bootstrap

setInterval(async () => {
  const result = await gmail.syncHistory({ startHistoryId: historyId });

  if (result.expired) {
    // Cursor too old (Gmail keeps ~7 days). Re-bootstrap from listMessages.
    const { historyId: fresh } = await gmail.getProfile();
    historyId = fresh;
    return;
  }

  for (const id of result.messageIds) {
    const msg = await gmail.getMessage(id);
    handleNewMessage(msg);
  }

  historyId = result.historyId;
}, 5 * 60_000);
```

## Replying within a thread

```ts
await gmail.reply({
  to: 'someone@example.com',
  subject: 'Re: original subject',
  body: 'Threaded reply.',
  inReplyTo: '<original-message-id@mail.gmail.com>',
  threadId: 'gmail-thread-id-here',
});
```

## OAuth setup

You need a Google Cloud project with the Gmail API enabled and an OAuth 2.0 client (Desktop app type works for self-use; Web app for hosted services).

1. Get a refresh token using the standard Google OAuth flow with scopes:
   - `https://www.googleapis.com/auth/gmail.send` — to send mail
   - `https://www.googleapis.com/auth/gmail.compose` — to create drafts
   - `https://www.googleapis.com/auth/gmail.readonly` — to read mail
2. Pass `clientId`, `clientSecret`, and `refreshToken` to `GmailClient`.

`gmail-edge` handles the rest (access-token refresh, caching, retry on 401).

## API surface

| Method                                     | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `gmail.getProfile()`                       | User email, message count, current historyId   |
| `gmail.listMessages({ q, maxResults, … })` | Search-style listing                           |
| `gmail.getMessage(id)`                     | Full message with payload                      |
| `gmail.getMessages(ids, concurrency?)`     | Parallel fetch with separated successes/errors |
| `gmail.syncHistory({ startHistoryId })`    | Incremental sync via Gmail history API         |
| `gmail.send(params)`                       | Send a message (supports threading, HTML)      |
| `gmail.draft(params)`                      | Create a draft                                 |
| `gmail.reply({ ..., inReplyTo, threadId })`| Convenience: send + thread                     |

Plus standalone helpers: `getBody`, `getHeader`, `findPart`, `buildRawEmail`, `utf8ToBase64Url`, `base64UrlToUtf8`, `encodeHeaderValue`, `stripHtml`.

## Runtime support

| Runtime             | Status      | Notes                                          |
| ------------------- | ----------- | ---------------------------------------------- |
| Cloudflare Workers  | ✅ Tested   | Use a KV-backed `TokenCache` for shared state  |
| Bun ≥1.1            | ✅ Tested   | Default `MemoryTokenCache` works               |
| Node ≥18            | ✅ Tested   | Native `fetch`; for older Node, polyfill       |
| Deno                | ✅ Should work | Pure standard APIs                          |
| Browsers            | ⚠️  Possible | Don't ship refresh tokens to clients           |

## Comparison to `googleapis`

|                       | `googleapis`                | `gmail-edge`            |
| --------------------- | --------------------------- | ----------------------- |
| Bundle size           | ~10 MB                      | ~10 KB minified         |
| Runtime               | Node only                   | Anywhere `fetch` lives  |
| Dependencies          | 30+                         | 0                       |
| Surface               | All Google APIs             | Gmail only              |
| OAuth flow            | Built-in interactive flow   | BYO (refresh token in)  |

If you need the full Google API surface or interactive OAuth flows, use `googleapis`. If you just need Gmail and want to ship to the edge, use this.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs welcome.

## License

MIT — see [LICENSE](./LICENSE).
