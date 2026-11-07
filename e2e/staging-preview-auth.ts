/** Reject stale Preview credentials before requests can expose them in transport errors. */
export function requireFreshPreviewOidcToken(token: string | undefined, now = Date.now()): void {
  if (!token) return;

  let expiresAt: unknown;
  try {
    const segments = token.split(".");
    if (segments.length !== 3) throw new Error("Invalid JWT segments");
    expiresAt = (JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8")) as { exp?: unknown }).exp;
  } catch {
    throw new Error("Preview OIDC token is malformed. Refresh it using an authenticated Vercel environment session.");
  }

  if (typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt)) {
    throw new Error("Preview OIDC token has no valid expiry. Refresh the Vercel environment session.");
  }
  if (expiresAt * 1000 <= now + 60_000) {
    throw new Error("Preview OIDC token has expired or expires within one minute. Refresh the Vercel environment session.");
  }
}

/** Playwright transport errors can echo request headers, including Preview OIDC credentials. */
export async function redactedPreviewRequest<T>(action: string, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch {
    throw new Error(`Preview ${action} failed. Check staging connectivity and authentication. Request headers withheld.`);
  }
}
