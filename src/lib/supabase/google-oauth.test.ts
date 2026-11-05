import { describe, expect, it } from "vitest";
import { googleOAuthCallbackUrl } from "./google-oauth";

describe("Google OAuth callback URL", () => {
  it("returns to the requested Rookline path after PKCE exchange", () => {
    const callback = new URL(googleOAuthCallbackUrl("http://localhost:3000", "/game/42?view=board#moves"));
    expect(callback.origin).toBe("http://localhost:3000");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/game/42?view=board#moves");
    expect(callback.searchParams.get("provider")).toBe("google");
  });

  it("rejects external destinations and uses the online lobby instead", () => {
    for (const target of ["//evil.example", "https://evil.example", "/\t/evil.example"]) {
      const callback = new URL(googleOAuthCallbackUrl("https://chess.example", target));
      expect(callback.searchParams.get("next")).toBe("/play/online");
    }
  });
});
