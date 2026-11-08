import { NextResponse } from "next/server";
import { type Square } from "chess.js";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { type OnlineGame, replayGame, validSquare, validUuid } from "@/lib/online/games";
import { applyLegalMove, gameResult } from "@/lib/chess/rules";
import { readLimitedJson } from "@/lib/online/request-json";
import { gameMutationLimit } from "@/lib/online/rate-limit";
import { rejectCrossOrigin } from "@/lib/online/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = performance.now();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const authenticatedAt = performance.now();
  const parsed = await readLimitedJson(request, 4096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid move request" }, { status: 422 });
  }
  const move = body as Record<string, unknown>;
  if (!validSquare(move.from) || !validSquare(move.to) || typeof move.requestId !== "string" || !validUuid(move.requestId) ||
    typeof move.expectedPly !== "number" || !Number.isSafeInteger(move.expectedPly) || move.expectedPly < 0 ||
    (move.promotion !== undefined && (typeof move.promotion !== "string" || !["q", "r", "b", "n"].includes(move.promotion)))) {
    return NextResponse.json({ error: "Invalid move request" }, { status: 422 });
  }
  const validated = {
    from: move.from as Square, to: move.to as Square,
    requestId: move.requestId as string, expectedPly: move.expectedPly as number,
    promotion: move.promotion as "q" | "r" | "b" | "n" | undefined,
  };
  const admin = context.admin;
  const gameReadStartedAt = performance.now();
  let gameReadMs = 0;
  const gameRead = Promise.resolve(admin.from("games").select("*").eq("id", id).maybeSingle()).then((result) => {
    gameReadMs = performance.now() - gameReadStartedAt;
    return result;
  });
  // The game read and actor-scoped limiter can overlap. A fresh move's
  // idempotency is enforced under the locked database commit transaction, so
  // it needs no additional moves-table read on the normal path.
  const checksStartedAt = performance.now();
  let checksMs = 0;
  const checks = gameMutationLimit(admin, context.user.id, "move").then((result) => {
    checksMs = performance.now() - checksStartedAt;
    return result;
  });
  const [{ data, error }, limited] = await Promise.all([gameRead, checks]);
  if (error || !data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const snapshot = data as OnlineGame;
  const actor = context.user.id;
  if (actor !== snapshot.white_id && actor !== snapshot.black_id) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  let rulesMs: number | null = null;
  let rpcMs: number | null = null;
  // Return the committed, server-owned board with the mutation response. This
  // removes a second browser round trip (including auth and expiry RPC) after
  // every move; the database remains authoritative for moves and clocks.
  const committedResponse = async (result: { status: string; ply: number }) => {
    const snapshotStartedAt = performance.now();
    const latest = await admin.from("games").select("*").eq("id", id).maybeSingle();
    const snapshotMs = performance.now() - snapshotStartedAt;
    const timings = [
      `auth;dur=${(authenticatedAt - startedAt).toFixed(1)}`,
      `game;dur=${gameReadMs.toFixed(1)}`,
      `checks;dur=${checksMs.toFixed(1)}`,
      ...(rulesMs === null ? [] : [`rules;dur=${rulesMs.toFixed(1)}`]),
      ...(rpcMs === null ? [] : [`rpc;dur=${rpcMs.toFixed(1)}`]),
      `snapshot;dur=${snapshotMs.toFixed(1)}`,
    ].join(", ");
    const headers = { "Cache-Control": "private, no-store", "Server-Timing": timings };
    if (latest.error || !latest.data) {
      // The client falls back to its normal authenticated GET when a read is
      // unavailable, without inventing a canonical position or clock.
      return NextResponse.json(result, { headers });
    }
    const game = latest.data as OnlineGame;
    if (game.white_id !== actor && game.black_id !== actor) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }
    return NextResponse.json({ ...result, game, viewerColor: game.white_id === actor ? "w" : "b", serverNow: Date.now() },
      { headers });
  };
  // The limiter still decides first, including on duplicate/retried requests.
  if (limited) return limited;
  // A retry arrives after the original commit advanced the game, so check
  // the durable idempotency key before reporting a stale/out-of-turn error.
  // The RPC independently checks the same key under the game-row lock.
  const currentMove = snapshot.status === "active" && validated.expectedPly === snapshot.ply &&
    (snapshot.turn === "w" ? snapshot.white_id : snapshot.black_id) === actor;
  if (!currentMove) {
    const retryStartedAt = performance.now();
    const duplicate = await admin.from("moves").select("ply,from_square,to_square,promotion")
      .eq("game_id", id).eq("player_id", actor).eq("idempotency_key", validated.requestId).maybeSingle();
    checksMs += performance.now() - retryStartedAt;
    if (duplicate.error) return NextResponse.json({ error: "Unable to validate request" }, { status: 503 });
    if (duplicate.data) {
      if (duplicate.data.ply !== validated.expectedPly + 1 || duplicate.data.from_square !== validated.from || duplicate.data.to_square !== validated.to || (duplicate.data.promotion ?? null) !== (validated.promotion ?? null)) {
        return NextResponse.json({ error: "Request ID already used for another move" }, { status: 409 });
      }
      return committedResponse({ status: "duplicate", ply: duplicate.data.ply });
    }
  }
  if (snapshot.status !== "active") return NextResponse.json({ error: "Game is not active" }, { status: 409 });
  if (validated.expectedPly !== snapshot.ply) return NextResponse.json({ error: "Stale game version" }, { status: 409 });
  if ((snapshot.turn === "w" ? snapshot.white_id : snapshot.black_id) !== actor) return NextResponse.json({ error: "Out of turn" }, { status: 409 });

  const rulesStartedAt = performance.now();
  let chess;
  try { chess = replayGame(snapshot); } catch { return NextResponse.json({ error: "Game ledger verification failed" }, { status: 503 }); }
  const played = applyLegalMove(chess, validated);
  if (!played) return NextResponse.json({ error: "Illegal chess move" }, { status: 422 });
  const result = gameResult(chess);
  const winner = result.winner === "w" ? snapshot.white_id : result.winner === "b" ? snapshot.black_id : null;
  rulesMs = performance.now() - rulesStartedAt;
  const rpcStartedAt = performance.now();
  const commit = await admin.rpc("rookline_commit_move", {
    p_game: id, p_player: actor, p_expected_ply: validated.expectedPly, p_request: validated.requestId,
    p_from: played.from, p_to: played.to, p_promotion: played.promotion || null,
    p_san: played.san, p_fen: chess.fen(), p_pgn: chess.pgn(), p_turn: chess.turn(),
    p_game_over: result.finished, p_result: result.finished ? result.label : null, p_winner: winner,
  });
  rpcMs = performance.now() - rpcStartedAt;
  if (commit.error) return NextResponse.json({ error: "Move conflict or authorization failure; reload game" }, { status: 409 });
  return committedResponse(commit.data as { status: string; ply: number });
}
