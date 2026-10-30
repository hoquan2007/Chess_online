import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { authenticatedGameContext } from "@/lib/supabase/server";
import type { OnlineGame } from "@/lib/online/games";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ authenticatedGameContext: vi.fn() }));

const id = "00000000-0000-4000-8000-000000000001";

function snapshot(changes: Partial<OnlineGame> = {}): OnlineGame {
  return {
    id, white_id: "white-id", black_id: "black-id", status: "active",
    fen: new Chess().fen(), pgn: "", ply: 0, turn: "w", base_ms: 300000,
    increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: "2026-10-30T00:00:00Z", result: null, winner_id: null,
    rated: false, created_at: "2026-10-30T00:00:00Z", ...changes,
  };
}

const request = new Request(`http://localhost/api/games/${id}`);
const params = { params: Promise.resolve({ id }) };

function setup(snapshots: OnlineGame[], rpcResult: { status: string } = { status: "active" }) {
  const maybeSingle = vi.fn().mockImplementation(async () => ({ data: snapshots.shift() ?? null, error: null }));
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
  const admin = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })), rpc };
  vi.mocked(authenticatedGameContext).mockResolvedValue({
    user: { id: "white-id" }, admin, status: 200, error: null,
  } as unknown as Awaited<ReturnType<typeof authenticatedGameContext>>);
  return { maybeSingle, rpc };
}

describe("GET online game canonical state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reloads a completed game after the expiry RPC waited for a resignation", async () => {
    const completed = snapshot({ status: "completed", result: "Resignation", winner_id: "black-id" });
    const { maybeSingle, rpc } = setup([snapshot({ ply: 4 }), completed], { status: "completed" });

    const response = await GET(request, params);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ game: completed, viewerColor: "w" });
    expect(payload.serverNow).toEqual(expect.any(Number));
    expect(Math.abs(Date.now() - payload.serverNow)).toBeLessThan(2000);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rpc).toHaveBeenCalledWith("rookline_expire_game", { p_game: id });
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("reloads an advanced ply after the expiry RPC waited for a move", async () => {
    const advanced = snapshot({ ply: 3, turn: "b" });
    const { maybeSingle } = setup([snapshot({ ply: 2 }), advanced]);

    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect((await response.json()).game).toMatchObject({ ply: 3, turn: "b" });
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("forbids nonparticipants before calling the privileged expiry RPC", async () => {
    const { rpc, maybeSingle } = setup([snapshot({ white_id: "another-user", black_id: "someone-else" })]);

    const response = await GET(request, params);
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
