import type { ClientOptions, OAuthCredentials, TokenCache } from './types';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Default in-memory token cache. Lifetime is the JS isolate; suitable for
 * single-process Node, Bun, Deno, or per-request Workers (where each
 * isolate gets its own cache).
 *
 * For shared caches across processes, pass a custom TokenCache to the
 * client (see README).
 */
export class MemoryTokenCache implements TokenCache {
  private token: string | null = null;
  private expiresAt = 0;

  async get(): Promise<string | null> {
    // 60s buffer prevents racing the expiry on slow networks.
    if (this.token && Date.now() < this.expiresAt - 60_000) {
      return this.token;
    }
    return null;
  }

  async set(token: string, expiresAt: number): Promise<void> {
    this.token = token;
    this.expiresAt = expiresAt;
  }
}

/**
 * Exchange a refresh token for an access token via Google's OAuth2 endpoint.
 * Caller is responsible for caching; use getAccessToken() unless you have
 * a reason to bypass the cache.
 */
export async function refreshAccessToken(
  credentials: OAuthCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; expiresAt: number }> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail OAuth token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  return {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Get a valid access token, using the cache if possible.
 */
export async function getAccessToken(
  opts: Required<Pick<ClientOptions, 'credentials'>> & {
    tokenCache: TokenCache;
    fetch: typeof fetch;
  },
): Promise<string> {
  const cached = await opts.tokenCache.get();
  if (cached) return cached;

  const { token, expiresAt } = await refreshAccessToken(opts.credentials, opts.fetch);
  await opts.tokenCache.set(token, expiresAt);
  return token;
}
