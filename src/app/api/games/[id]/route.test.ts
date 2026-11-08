import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { authenticatedGameReadContext } from "@/lib/supabase/server";
import type { OnlineGame } from "@/lib/online/games";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ authenticatedGameReadContext: vi.fn() }));

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
  vi.mocked(authenticatedGameReadContext).mockResolvedValue({
    user: { id: "white-id" }, admin, status: 200, error: null,
  } as unknown as Awaited<ReturnType<typeof authenticatedGameReadContext>>);
  return { maybeSingle, rpc };
}

describe("GET online game canonical state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ROOKLINE_FAST_GAME_SNAPSHOT;
  });

  it("uses one authenticated read when an unrated clock is comfortably running", async () => {
    const running = snapshot({ clock_anchor_at: new Date(Date.now() - 5000).toISOString() });
    const { maybeSingle, rpc } = setup([running]);

    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ game: running, viewerColor: "w" });
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
    expect(response.headers.get("Server-Timing")).toMatch(/^auth;dur=\d+\.\d, snapshot;dur=\d+\.\d$/);
  });

  it("keeps PostgreSQL expiry and fresh reads for near-deadline and rated games", async () => {
    const nearDeadline = snapshot({
      clock_anchor_at: new Date(Date.now() - 5000).toISOString(), white_ms: 64_000,
    });
    const { maybeSingle, rpc } = setup([nearDeadline, nearDeadline]);
    expect((await GET(request, params)).status).toBe(200);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("rookline_expire_game", { p_game: id });

    const rated = snapshot({
      clock_anchor_at: new Date(Date.now() - 5000).toISOString(), rated: true,
    });
    const ratedChecks = setup([rated, rated]);
    expect((await GET(request, params)).status).toBe(200);
    expect(ratedChecks.maybeSingle).toHaveBeenCalledTimes(2);
    expect(ratedChecks.rpc).toHaveBeenCalledWith("rookline_expire_game", { p_game: id });
  });

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
    expect(response.headers.get("Server-Timing")).toMatch(/^auth;dur=\d+\.\d, snapshot;dur=\d+\.\d$/);
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

describe("GET game with gated atomic snapshot RPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ROOKLINE_FAST_GAME_SNAPSHOT = "1";
  });
  afterEach(() => { delete process.env.ROOKLINE_FAST_GAME_SNAPSHOT; });

  it("returns a post-lock canonical move snapshot with one remote call", async () => {
    const advanced = snapshot({ ply: 3, turn: "b" });
    const { rpc, maybeSingle } = setup([]);
    rpc.mockResolvedValueOnce({ data: { result: "ok", game: advanced }, error: null });

    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ game: advanced, viewerColor: "w" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rookline_read_player_game", { p_game: id, p_player: "white-id" });
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("returns timeout settlement from the locked transaction", async () => {
    const expired = snapshot({ status: "completed", result: "timeout", white_ms: 0 });
    const { rpc } = setup([]);
    rpc.mockResolvedValueOnce({ data: { result: "ok", game: expired }, error: null });
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect((await response.json()).game).toMatchObject(expired);
  });

  it("preserves the waiting-room joinable denial without disclosing the row", async () => {
    const { rpc, maybeSingle } = setup([]);
    rpc.mockResolvedValueOnce({ data: { result: "forbidden", joinable: true }, error: null });
    const response = await GET(request, params);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "You are not a player", joinable: true });
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("maps unknown games to 404", async () => {
    const { rpc } = setup([]);
    rpc.mockResolvedValueOnce({ data: { result: "not_found" }, error: null });
    const response = await GET(request, params);
    expect(response.status).toBe(404);
  });

  it("fails closed if the migration is missing or the returned row is forged", async () => {
    const { rpc, maybeSingle } = setup([]);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "function does not exist" } });
    expect((await GET(request, params)).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: { result: "ok", game: snapshot({ white_id: "other", black_id: "other" }) }, error: null });
    expect((await GET(request, params)).status).toBe(503);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
