import { NextResponse } from "next/server";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { type OnlineGame, replayGame, validUuid } from "@/lib/online/games";
import { mayClaimDraw, type DrawClaim } from "@/lib/chess/rules";
import { readLimitedJson } from "@/lib/online/request-json";
import { gameMutationLimit } from "@/lib/online/rate-limit";
import { rejectCrossOrigin } from "@/lib/online/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const parsed = await readLimitedJson(request, 512);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !("rule" in body) || typeof body.rule !== "string" || !["repetition", "fiftyMoves"].includes(body.rule) ||
    !("expectedPly" in body) || typeof body.expectedPly !== "number" ||
    !Number.isSafeInteger(body.expectedPly) || body.expectedPly < 0) {
    return NextResponse.json({ error: "Invalid draw claim" }, { status: 422 });
  }
  const rule = body.rule as DrawClaim;
  const expectedPly = body.expectedPly as number;
  const actor = context.user.id;
  const limited = await gameMutationLimit(context.admin, actor, "claim");
  if (limited) return limited;
  const { data, error } = await context.admin.from("games").select("*").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const snapshot = data as OnlineGame;
  if (actor !== snapshot.white_id && actor !== snapshot.black_id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (snapshot.status !== "active" || snapshot.ply !== expectedPly) {
    return NextResponse.json({ error: "Game state changed. Reload to claim a draw." }, { status: 409 });
  }
  let chess;
  try { chess = replayGame(snapshot); }
  catch { return NextResponse.json({ error: "Game ledger verification failed" }, { status: 503 }); }
  const side = actor === snapshot.white_id ? "w" : "b";
  if (!mayClaimDraw(chess, side, rule)) {
    return NextResponse.json({ error: "Draw cannot be claimed from this position" }, { status: 422 });
  }
  const commit = await context.admin.rpc("rookline_claim_draw", {
    p_game: id, p_player: actor, p_expected_ply: expectedPly, p_rule: rule,
  });
  if (commit.error) return NextResponse.json({ error: "Draw claim conflicted with another action or the clock. Reload game." }, { status: 409 });
  return NextResponse.json(commit.data, { headers: { "Cache-Control": "no-store" } });
}
