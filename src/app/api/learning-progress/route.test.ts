import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "10000000-0000-4000-8000-000000000001";
const getUser = vi.fn();
const serverSupabase = vi.fn();
const limit = vi.fn();
const upsert = vi.fn();
const eq = vi.fn(() => ({ eq, limit }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select, upsert }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: () => serverSupabase() }));
import { GET, POST } from "./route";

function write(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://rookline.example/api/learning-progress", {
    method: "POST", headers: {
      origin: "https://rookline.example", host: "rookline.example", "Content-Type": "application/json",
      "X-Rookline-Account": userId, ...headers,
    }, body: JSON.stringify(payload),
  });
}

describe("/api/learning-progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverSupabase.mockResolvedValue({ auth: { getUser }, from });
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    limit.mockResolvedValue({ data: [{ item_id: "mate-001" }, { item_id: "forged" }], error: null });
    upsert.mockResolvedValue({ error: null });
  });

  it("reads only authorized account completions and filters invalid IDs", async () => {
    const result = await GET(new Request("https://rookline.example/api/learning-progress?kind=puzzle"));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await result.json()).toEqual({ accountId: userId, ids: ["mate-001"] });
    expect(from).toHaveBeenCalledWith("learning_progress");
    expect(eq).toHaveBeenCalledWith("user_id", userId);
    expect(eq).toHaveBeenCalledWith("kind", "puzzle");
    expect(limit).toHaveBeenCalledWith(64);
  });

  it("upserts the verified user only, with deduplicating unique key", async () => {
    const result = await POST(write({ kind: "puzzle", ids: ["mate-001", "mate-002"] }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ saved: 2 });
    expect(upsert).toHaveBeenCalledWith([
      { user_id: userId, kind: "puzzle", item_id: "mate-001" },
      { user_id: userId, kind: "puzzle", item_id: "mate-002" },
    ], { onConflict: "user_id,kind,item_id", ignoreDuplicates: true });
  });

  it("refuses a cross-origin request before authenticating and a stale account afterward", async () => {
    expect((await POST(write({ kind: "puzzle", ids: ["mate-001"] }, { origin: "https://attacker.example" }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect((await POST(write({ kind: "puzzle", ids: ["mate-001"] }, { "X-Rookline-Account": "other" }))).status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("fails closed without server configuration or session", async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://rookline.example/api/learning-progress?kind=puzzle"))).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write({ kind: "puzzle", ids: ["mate-001"] }))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects unsupported categories, forged ID and oversized JSON", async () => {
    expect((await GET(new Request("https://rookline.example/api/learning-progress?kind=ratings"))).status).toBe(422);
    expect((await POST(write({ kind: "puzzle", ids: ["mate-001"], user_id: "forged" }))).status).toBe(422);
    expect((await POST(write({ kind: "puzzle", ids: ["mate-001"], padding: "x".repeat(5000) }))).status).toBe(413);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns generic errors when PostgreSQL fails", async () => {
    limit.mockResolvedValueOnce({ data: null, error: { message: "secret DB error" } });
    expect(await (await GET(new Request("https://rookline.example/api/learning-progress?kind=puzzle"))).json())
      .toEqual({ error: "Unable to load learning progress" });
    upsert.mockResolvedValueOnce({ error: { message: "private DB detail" } });
    expect(await (await POST(write({ kind: "puzzle", ids: ["mate-001"] }))).json())
      .toEqual({ error: "Unable to save learning progress" });
  });
});
