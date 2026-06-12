import { IntegrationError } from "@/lib/integrations/errors";

// OAuth2 client-credentials token helper for the Warcraft Logs v2 API, with a
// small in-memory expiry cache so we don't mint a token per request. WCL tokens
// last ~1 year, but we treat them as short-lived and refresh on expiry anyway.

const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";

export interface WclCredentials {
  clientId: string;
  clientSecret: string;
}

interface CachedToken {
  token: string;
  /** epoch ms after which the token is considered stale. */
  expiresAt: number;
}

// Module-level cache keyed by clientId (one process, usually one client).
const cache = new Map<string, CachedToken>();

// Refresh a minute before the real expiry to avoid edge-of-expiry failures.
const EXPIRY_SKEW_MS = 60_000;

/**
 * Returns a valid bearer token, minting (and caching) a new one if needed.
 * `now` is injectable for tests; defaults to the real clock at call time.
 */
export async function getAccessToken(
  creds: WclCredentials,
  now: () => number = () => Date.now(),
): Promise<string> {
  const cached = cache.get(creds.clientId);
  if (cached && cached.expiresAt > now()) {
    return cached.token;
  }

  const basic = Buffer.from(
    `${creds.clientId}:${creds.clientSecret}`,
  ).toString("base64");

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials",
    });
  } catch (cause) {
    throw new IntegrationError("warcraftlogs", "token request failed", cause);
  }

  if (!res.ok) {
    throw new IntegrationError(
      "warcraftlogs",
      `token request returned ${res.status}`,
    );
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new IntegrationError("warcraftlogs", "token response had no access_token");
  }

  const ttlMs = (body.expires_in ?? 3600) * 1000;
  cache.set(creds.clientId, {
    token: body.access_token,
    expiresAt: now() + ttlMs - EXPIRY_SKEW_MS,
  });
  return body.access_token;
}

/** Test seam: drop the cached token(s). */
export function clearTokenCache(): void {
  cache.clear();
}
