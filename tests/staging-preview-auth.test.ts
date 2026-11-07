import { describe, expect, it } from "vitest";
import { redactedPreviewRequest, requireFreshPreviewOidcToken } from "../e2e/staging-preview-auth";

const now = Date.UTC(2026, 10, 8);

function token(expiresAt: number) {
  return `header.${Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url")}.signature`;
}

describe("protected staging request safeguards", () => {
  it("accepts missing or unexpired tokens and rejects stale or invalid OIDC credentials", () => {
    expect(() => requireFreshPreviewOidcToken(undefined, now)).not.toThrow();
    expect(() => requireFreshPreviewOidcToken(token(now / 1000 + 61), now)).not.toThrow();
    expect(() => requireFreshPreviewOidcToken(token(now / 1000 + 60), now)).toThrow(/expires/);
    expect(() => requireFreshPreviewOidcToken(token(now / 1000 - 20), now)).toThrow(/expired/);
    expect(() => requireFreshPreviewOidcToken("private-token", now)).toThrow(/malformed/);
    expect(() => requireFreshPreviewOidcToken("a.e30.c", now)).toThrow(/expiry/);
  });

  it("never forwards a request failure containing confidential headers to reporters", async () => {
    const secret = "mock-private-oidc-token-must-not-leak";
    const failure = new Error(`getaddrinfo ENOTFOUND\nheaders: x-vercel-trusted-oidc-idp-token: ${secret}`);
    await expect(redactedPreviewRequest("login preflight", () => Promise.reject(failure)))
      .rejects.toThrow("Preview login preflight failed. Check staging connectivity and authentication. Request headers withheld.");
    try {
      await redactedPreviewRequest("game creation", () => Promise.reject(failure));
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect((error as Error).cause).toBeUndefined();
    }
  });
});
