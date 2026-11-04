import { beforeEach, describe, expect, it, vi } from "vitest";

const serverSupabase = vi.fn();
const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: () => serverSupabase() }));
import { GET } from "./route";

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverSupabase.mockResolvedValue({ auth: { exchangeCodeForSession, verifyOtp } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("exchanges PKCE codes and keeps the safe return path", async () => {
    const response = await GET(new Request("https://rookline.example/auth/callback?code=code-value&next=%2Fgame%2Fsample"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://rookline.example/game/sample");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-value");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies email token-hash links and prevents an external redirect", async () => {
    const response = await GET(new Request("https://rookline.example/auth/callback?token_hash=hash-value&type=email&next=https%3A%2F%2Fevil.example"));
    expect(response.headers.get("location")).toBe("https://rookline.example/play/online");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-value", type: "email" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("rejects unsupported token types and preserves a safe next on failure", async () => {
    const invalid = await GET(new Request("https://rookline.example/auth/callback?token_hash=hash&type=phone_change&next=%2Ffriends"));
    expect(invalid.headers.get("location")).toBe("https://rookline.example/login?error=confirmation&next=%2Ffriends");
    expect(verifyOtp).not.toHaveBeenCalled();
    exchangeCodeForSession.mockResolvedValueOnce({ error: { message: "invalid code" } });
    const failed = await GET(new Request("https://rookline.example/auth/callback?code=expired&next=%2Fgame%2Fsample"));
    expect(failed.headers.get("location")).toBe("https://rookline.example/login?error=confirmation&next=%2Fgame%2Fsample");
  });

  it("fails closed when the Supabase client is not configured", async () => {
    serverSupabase.mockResolvedValueOnce(null);
    const response = await GET(new Request("https://rookline.example/auth/callback?code=sample"));
    expect(response.headers.get("location")).toBe("https://rookline.example/login?error=confirmation&next=%2Fplay%2Fonline");
  });

  it("hands fragment-based confirmations to the browser without trusting the return URL", async () => {
    const response = await GET(new Request("https://rookline.example/auth/callback?next=https%3A%2F%2Fevil.example"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://rookline.example/auth/complete?next=%2Fplay%2Fonline");
    expect(serverSupabase).not.toHaveBeenCalled();
  });

  it("rejects explicit authorization errors without attempting fragment fallback", async () => {
    const response = await GET(new Request("https://rookline.example/auth/callback?error=access_denied&next=%2Ffriends"));
    expect(response.headers.get("location")).toBe("https://rookline.example/login?error=confirmation&next=%2Ffriends");
  });
});
