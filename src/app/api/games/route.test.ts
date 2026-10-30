import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "10000000-0000-4000-8000-000000000001";
const admin = { from: vi.fn() };
const authenticatedGameContext = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ authenticatedGameContext: () => authenticatedGameContext() }));
vi.mock("@/lib/online/rate-limit", () => ({ gameMutationLimit: vi.fn() }));

import { GET } from "./route";
import { encodeHistoryCursor } from "@/lib/online/history";

function example(index: number, created_at = "2026-10-30T14:21:07.123456+00:00") {
  return { id: `20000000-0000-4000-8000-${index.toString().padStart(12, "0")}`, created_at,
    white_id: userId, black_id: null, base_ms: 300000, increment_ms: 0, status: "waiting", result: null,
    winner_id: null, ply: 0 };
}

describe("GET /api/games", () => {
  let or: ReturnType<typeof vi.fn>;
  let order: ReturnType<typeof vi.fn>;
  let limit: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: Array.from({ length: 51 }, (_, i) => example(100 - i)), error: null });
    or = query.or; order = query.order; limit = query.limit;
    admin.from.mockReturnValue(query);
    authenticatedGameContext.mockResolvedValue({ admin, user: { id: userId }, status: 200, error: null });
  });

  it("returns 50 games, stable ordered cursor, and no-store cache policy", async () => {
    const response = await GET(new Request("https://rookline.example/api/games"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.games).toHaveLength(50);
    expect(body.nextCursor).toBe(encodeHistoryCursor(example(51)));
    expect(or).toHaveBeenCalledWith(`white_id.eq.${userId},black_id.eq.${userId}`);
    expect(order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(limit).toHaveBeenCalledWith(51);
  });

  it("uses a membership-restricted tie-breaker on subsequent pages", async () => {
    const cursor = encodeHistoryCursor(example(51));
    const response = await GET(new Request(`https://rookline.example/api/games?cursor=${cursor}`));
    expect(response.status).toBe(200);
    expect(or.mock.calls[0][0]).toContain(`and(white_id.eq.${userId},created_at.eq.2026-10-30T14:21:07.123456+00:00,id.lt.${example(51).id})`);
    expect(or.mock.calls[0][0]).toContain(`and(black_id.eq.${userId},created_at.lt.2026-10-30T14:21:07.123456+00:00)`);
  });

  it("ends pagination exactly when no 51st row exists", async () => {
    limit.mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => example(50 - i)), error: null });
    const response = await GET(new Request("https://rookline.example/api/games"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.games).toHaveLength(50);
    expect(body.nextCursor).toBeNull();
  });

  it("does not expose data when the database query fails", async () => {
    limit.mockResolvedValueOnce({ data: [example(1)], error: { message: "sensitive database details" } });
    const response = await GET(new Request("https://rookline.example/api/games"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Could not load games" });
  });

  it("rejects malformed cursors before any privileged database reads", async () => {
    const response = await GET(new Request("https://rookline.example/api/games?cursor=bad%29%2Cid.eq.attacker"));
    expect(response.status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("fails closed without a verified session", async () => {
    authenticatedGameContext.mockResolvedValue({ user: null, admin: null, status: 401, error: "Sign in" });
    const response = await GET(new Request("https://rookline.example/api/games"));
    expect(response.status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
  });
});
