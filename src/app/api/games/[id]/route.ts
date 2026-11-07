import { NextResponse } from "next/server";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { type OnlineGame, validUuid } from "@/lib/online/games";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext) {
  const startedAt = performance.now();
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const authenticatedAt = performance.now();
  const snapshotHeaders = () => ({
    "Cache-Control": "private, no-store",
    "Server-Timing": `auth;dur=${(authenticatedAt - startedAt).toFixed(1)}, snapshot;dur=${(performance.now() - authenticatedAt).toFixed(1)}`,
  });
  // Opt in only after the service-only RPC has been installed and exercised on
  // staging. One PostgREST call performs the seat check, row-locked clock
  // expiry and canonical read in one database transaction.
  if (process.env.ROOKLINE_FAST_GAME_SNAPSHOT === "1") {
    const result = await context.admin.rpc("rookline_read_player_game", {
      p_game: id,
      p_player: context.user.id,
    });
    if (result.error || !result.data || typeof result.data !== "object") {
      return NextResponse.json({ error: "Game unavailable" }, { status: 503 });
    }
    const data = result.data as { result?: string; joinable?: boolean; game?: OnlineGame };
    if (data.result === "not_found") return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (data.result === "forbidden") {
      return NextResponse.json({ error: "You are not a player", joinable: data.joinable === true }, { status: 403 });
    }
    const game = data.game;
    if (data.result !== "ok" || !game || game.id !== id ||
        (game.white_id !== context.user.id && game.black_id !== context.user.id)) {
      return NextResponse.json({ error: "Game unavailable" }, { status: 503 });
    }
    return NextResponse.json({ game, viewerColor: game.white_id === context.user.id ? "w" : "b", serverNow: Date.now() }, {
      headers: snapshotHeaders(),
    });
  }
  const load = () => context.admin!.from("games").select("*").eq("id", id).maybeSingle();
  const first = await load();
  if (first.error || !first.data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  let game = first.data as OnlineGame;
  if (game.white_id !== context.user.id && game.black_id !== context.user.id) {
    return NextResponse.json({ error: "You are not a player", joinable: game.status === "waiting" }, { status: 403 });
  }
  // A healthy unrated clock does not need two extra network round trips just
  // to confirm it has not expired. Keep a generous boundary before the
  // deadline, and always let PostgreSQL settle near-timeout or rated games.
  // This estimate only selects the read path; move/clock authority stays in
  // the locked database transaction.
  const sampledAt = Date.now();
  const anchor = game.clock_anchor_at ? Date.parse(game.clock_anchor_at) : NaN;
  const turnRemaining = game.turn === "w" ? game.white_ms : game.black_ms;
  const healthyUnratedClock = game.status === "active" && !game.rated &&
    Number.isFinite(anchor) && anchor <= sampledAt &&
    Number.isSafeInteger(turnRemaining) && turnRemaining > 0 &&
    anchor + turnRemaining - sampledAt > 60_000;
  if (game.status === "active" && !healthyUnratedClock) {
    const settled = await context.admin.rpc("rookline_expire_game", { p_game: id });
    if (settled.error) return NextResponse.json({ error: "Cannot validate clock" }, { status: 503 });
    // The RPC may wait behind a move or resignation. Its returned status does
    // not guarantee that the first snapshot is still current.
    const latest = await load();
    if (latest.error || !latest.data) return NextResponse.json({ error: "Game unavailable" }, { status: 503 });
    game = latest.data as OnlineGame;
    if (game.white_id !== context.user.id && game.black_id !== context.user.id) {
      return NextResponse.json({ error: "You are not a player" }, { status: 403 });
    }
  }
  // Sample after the database call, as close to response delivery as possible.
  // This is a display-only synchronization hint; database time remains authoritative.
  return NextResponse.json({ game, viewerColor: game.white_id === context.user.id ? "w" : "b", serverNow: Date.now() }, { headers: snapshotHeaders() });
}
