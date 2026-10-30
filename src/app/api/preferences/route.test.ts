import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "10000000-0000-4000-8000-000000000001";
const getUser = vi.fn();
const serverSupabase = vi.fn();
const maybeSingle = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq, single }));
const upsert = vi.fn(() => ({ select }));
const from = vi.fn(() => ({ select, upsert }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: () => serverSupabase() }));
import { GET, PATCH } from "./route";

function preferenceRequest(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://rookline.example/api/preferences", {
    method: "PATCH", headers: { origin: "https://rookline.example", host: "rookline.example", "X-Rookline-Account": userId, ...headers },
    body: JSON.stringify(payload),
  });
}

describe("/api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverSupabase.mockResolvedValue({ auth: { getUser }, from });
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    maybeSingle.mockResolvedValue({ data: { theme: "light", sounds_enabled: false }, error: null });
    single.mockResolvedValue({ data: { theme: "light", sounds_enabled: false }, error: null });
  });

  it("reads only the verified account preference row with private caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ preferences: { theme: "light", sounds_enabled: false } });
    expect(from).toHaveBeenCalledWith("preferences");
    expect(select).toHaveBeenCalledWith("theme,sounds_enabled");
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("reports an absent row, without creating a record during GET", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await (await GET()).json()).toEqual({ preferences: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts only the authenticated account's allowed fields", async () => {
    const response = await PATCH(preferenceRequest({ theme: "light", sounds_enabled: false }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ preferences: { theme: "light", sounds_enabled: false } });
    expect(upsert).toHaveBeenCalledWith({ user_id: userId, theme: "light", sounds_enabled: false }, { onConflict: "user_id" });
  });

  it("denies a queued write after the authenticated account changes", async () => {
    const response = await PATCH(preferenceRequest({ theme: "light", sounds_enabled: false },
      { "X-Rookline-Account": "20000000-0000-4000-8000-000000000002" }));
    expect(response.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
    const absentHeader = await PATCH(preferenceRequest({ theme: "light", sounds_enabled: false },
      { "X-Rookline-Account": "" }));
    expect(absentHeader.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects hostile or missing Origin before authentication", async () => {
    expect((await PATCH(preferenceRequest({ theme: "light", sounds_enabled: false }, { origin: "https://attacker.example" }))).status).toBe(403);
    expect((await PATCH(new Request("https://rookline.example/api/preferences", {
      method: "PATCH", headers: { host: "rookline.example" }, body: "{}",
    }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
  });

  it("fails closed without Supabase or an authenticated user", async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await PATCH(preferenceRequest({ theme: "dark", sounds_enabled: true }))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects forged owner and rating fields", async () => {
    const response = await PATCH(preferenceRequest({ theme: "dark", sounds_enabled: true, user_id: "attacker", rating: 3000 }));
    expect(response.status).toBe(422);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("enforces the byte limit and hides persistence details", async () => {
    expect((await PATCH(preferenceRequest({ theme: "light", sounds_enabled: true, extra: "x".repeat(500) }))).status).toBe(413);
    expect(upsert).not.toHaveBeenCalled();
    single.mockResolvedValueOnce({ data: null, error: { message: "sensitive database detail" } });
    const response = await PATCH(preferenceRequest({ theme: "light", sounds_enabled: false }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to save preferences" });
  });

  it("hides read errors", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "secret detail" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to load preferences" });
  });
});
