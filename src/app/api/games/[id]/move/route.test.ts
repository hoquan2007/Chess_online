import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { gameMutationLimit } from "@/lib/online/rate-limit";
import type { OnlineGame } from "@/lib/online/games";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({ authenticatedGameContext: vi.fn() }));
vi.mock("@/lib/online/rate-limit", () => ({ gameMutationLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/online/request-origin", () => ({ rejectCrossOrigin: vi.fn().mockReturnValue(null) }));

const id = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const params = { params: Promise.resolve({ id }) };

function game(changes: Partial<OnlineGame> = {}): OnlineGame {
  return {
    id, white_id: "white-id", black_id: "black-id", status: "active",
    fen: new Chess().fen(), pgn: "", ply: 0, turn: "w", base_ms: 300000,
    increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: new Date().toISOString(), result: null, winner_id: null,
    rated: false, created_at: "2026-10-30T00:00:00Z", ...changes,
  };
}

function setup(options: {
  games: Array<OnlineGame | null>;
  duplicate?: { ply: number; from_square: string; to_square: string; promotion: string | null } | null;
  commit?: { status: string; ply: number };
  failure?: boolean;
}) {
  const games = [...options.games];
  const gameRead = vi.fn().mockImplementation(async () => ({
    data: games.shift() ?? null, error: options.failure && games.length === 0 ? { message: "read failed" } : null,
  }));
  const moveRead = vi.fn().mockResolvedValue({ data: options.duplicate ?? null, error: null });
  const rpc = vi.fn().mockResolvedValue({ data: options.commit ?? { status: "accepted", ply: 1 }, error: null });
  const from = vi.fn((table: string) => {
    const query = {
      maybeSingle: table === "games" ? gameRead : moveRead,
      eq: vi.fn(),
    };
    query.eq.mockReturnValue(query);
    return { select: () => query };
  });
  const admin = { from, rpc };
  vi.mocked(authenticatedGameContext).mockResolvedValue({
    user: { id: "white-id" }, admin, status: 200, error: null,
  } as unknown as Awaited<ReturnType<typeof authenticatedGameContext>>);
  return { gameRead, moveRead, rpc, from };
}

function request() {
  return new Request(`http://localhost/api/games/${id}/move`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "e2", to: "e4", expectedPly: 0, requestId }),
  });
}

describe("POST move committed snapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the database's authoritative board and clock with the accepted move", async () => {
    const chess = new Chess(); chess.move("e4");
    const committed = game({ fen: chess.fen(), pgn: chess.pgn(), ply: 1, turn: "b", white_ms: 299123 });
    const { gameRead, rpc } = setup({ games: [game(), committed] });
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ status: "accepted", ply: 1, game: committed, viewerColor: "w" });
    expect(Math.abs(payload.serverNow - Date.now())).toBeLessThan(2000);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Server-Timing")).toMatch(/^auth;dur=\d+\.\d, game;dur=\d+\.\d, checks;dur=\d+\.\d, rules;dur=\d+\.\d, rpc;dur=\d+\.\d, snapshot;dur=\d+\.\d$/);
    expect(gameRead).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("rookline_commit_move", expect.objectContaining({
      p_game: id, p_player: "white-id", p_expected_ply: 0, p_request: requestId,
    }));
  });

  it("returns latest server game on a repeated request without replaying the mutation", async () => {
    const chess = new Chess(); chess.move("e4");
    const committed = game({ fen: chess.fen(), pgn: chess.pgn(), ply: 1, turn: "b" });
    const { rpc, gameRead } = setup({
      games: [committed, committed], duplicate: { ply: 1, from_square: "e2", to_square: "e4", promotion: null },
    });
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "duplicate", ply: 1, game: committed });
    expect(response.headers.get("Server-Timing")).toContain("snapshot;dur=");
    expect(response.headers.get("Server-Timing")).not.toContain("rpc;dur=");
    expect(gameRead).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("starts duplicate lookup while rate limiting is pending and still honors denial", async () => {
    let finishLimit: ((value: NextResponse | null) => void) | undefined;
    vi.mocked(gameMutationLimit).mockImplementationOnce(() => new Promise<NextResponse | null>((resolve) => {
      finishLimit = resolve;
    }));
    const { moveRead, rpc } = setup({ games: [game()] });
    const pending = POST(request(), params);
    await vi.waitFor(() => expect(moveRead).toHaveBeenCalledOnce());
    expect(rpc).not.toHaveBeenCalled();
    finishLimit!(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    const response = await pending;
    expect(response.status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("delivers the database's timeout result rather than a speculative moved position", async () => {
    const timeout = game({ status: "completed", result: "timeout", winner_id: "black-id", white_ms: 0, clock_anchor_at: null });
    setup({ games: [game(), timeout], commit: { status: "timeout", ply: 0 } });
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "timeout", ply: 0, game: timeout });
  });

  it("falls back to the legacy acknowledgement when the post-commit database read fails", async () => {
    setup({ games: [game(), null], failure: true });
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "accepted", ply: 1 });
    expect(response.headers.get("Server-Timing")).toContain("rpc;dur=");
    expect(response.headers.get("Server-Timing")).toContain("snapshot;dur=");
  });

  it("does not disclose a game if participant access changes after the RPC", async () => {
    setup({ games: [game(), game({ white_id: "other-id", black_id: "someone-else" })] });
    const response = await POST(request(), params);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not a participant" });
  });
});
