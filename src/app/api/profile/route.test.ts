import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "10000000-0000-4000-8000-000000000001";
const getUser = vi.fn();
const serverSupabase = vi.fn();
const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: () => serverSupabase() }));
import { PATCH } from "./route";

function profileRequest(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://rookline.example/api/profile", {
    method: "PATCH", headers: { origin: "https://rookline.example", host: "rookline.example", ...headers },
    body: JSON.stringify(payload),
  });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverSupabase.mockResolvedValue({ auth: { getUser }, from });
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    maybeSingle.mockResolvedValue({ data: { username: "newname", display_name: "New Name" }, error: null });
  });

  it("updates only the signed-in user's public identity fields", async () => {
    const response = await PATCH(profileRequest({ username: "NewName", display_name: "  New Name  " }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ profile: { username: "newname", display_name: "New Name" } });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ username: "newname", display_name: "New Name" });
    expect(eq).toHaveBeenCalledWith("id", userId);
  });

  it("denies a cross-site origin without touching auth or data", async () => {
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name" }, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("denies missing Origin and Fetch Metadata", async () => {
    const response = await PATCH(new Request("https://rookline.example/api/profile", {
      method: "PATCH", headers: { host: "rookline.example", "Content-Type": "application/json" },
      body: JSON.stringify({ username: "newname", display_name: "New Name" }),
    }));
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed without configured Supabase", async () => {
    serverSupabase.mockResolvedValueOnce(null);
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name" }));
    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects anonymous users", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name" }));
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects attempts to update another user or ratings", async () => {
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name", id: "outsider", rating: 4000 }));
    expect(response.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects oversized requests before any mutation", async () => {
    const response = await PATCH(profileRequest({ username: "newname", display_name: "A".repeat(600) }));
    expect(response.status).toBe(413);
    expect(update).not.toHaveBeenCalled();
  });

  it("reports username collision without leaking database information", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "private index detail" } });
    const response = await PATCH(profileRequest({ username: "taken", display_name: "New Name" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This username is already taken" });
  });

  it("does not report an update when the user row is missing", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name" }));
    expect(response.status).toBe(404);
  });

  it("hides unexpected persistence errors", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "DB internals" } });
    const response = await PATCH(profileRequest({ username: "newname", display_name: "New Name" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to save your profile" });
  });
});
