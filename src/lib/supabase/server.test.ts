import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { authenticatedGameContext, authenticatedGameReadContext } from "./server";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ getAll: () => [], setAll: vi.fn() })) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const playerId = "00000000-0000-4000-8000-000000000001";
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret: process.env.SUPABASE_SECRET_KEY,
  legacySecret: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const getClaims = vi.fn();
const getUser = vi.fn();

describe("read-only game authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
    process.env.SUPABASE_SECRET_KEY = "server-test-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(createServerClient).mockReturnValue({ auth: { getClaims, getUser } } as unknown as ReturnType<typeof createServerClient>);
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(), rpc: vi.fn() } as unknown as ReturnType<typeof createClient>);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: originalEnv.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: originalEnv.publishable,
      SUPABASE_SECRET_KEY: originalEnv.secret,
      SUPABASE_SERVICE_ROLE_KEY: originalEnv.legacySecret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("accepts a verified claims subject without a remote getUser call", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: playerId } }, error: null });
    const result = await authenticatedGameReadContext();
    expect(result).toMatchObject({ user: { id: playerId }, status: 200, error: null });
    expect(result.admin).toBeTruthy();
    expect(getClaims).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "forged-user-id", 7])("denies missing or invalid claims subjects (%s)", async (sub) => {
    getClaims.mockResolvedValue({ data: sub === null ? null : { claims: { sub } }, error: null });
    const result = await authenticatedGameReadContext();
    expect(result).toMatchObject({ user: null, admin: null, status: 401 });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("denies failed token verification", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: playerId } }, error: new Error("expired JWT") });
    expect(await authenticatedGameReadContext()).toMatchObject({ user: null, admin: null, status: 401 });
  });

  it("returns 503 for missing credentials without reading cookies or claims", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    expect(await authenticatedGameReadContext()).toMatchObject({ user: null, admin: null, status: 503 });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("keeps the getUser authentication boundary for mutations", async () => {
    getUser.mockResolvedValue({ data: { user: { id: playerId } }, error: null });
    const result = await authenticatedGameContext();
    expect(result).toMatchObject({ user: { id: playerId }, status: 200 });
    expect(getUser).toHaveBeenCalledOnce();
    expect(getClaims).not.toHaveBeenCalled();
  });
});
