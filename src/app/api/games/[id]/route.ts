import { NextResponse } from "next/server";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { type OnlineGame, validUuid } from "@/lib/online/games";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const load = () => context.admin!.from("games").select("*").eq("id", id).maybeSingle();
  const first = await load();
  if (first.error || !first.data) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  let game = first.data as OnlineGame;
  if (game.white_id !== context.user.id && game.black_id !== context.user.id) {
    return NextResponse.json({ error: "You are not a player", joinable: game.status === "waiting" }, { status: 403 });
  }
  if (game.status === "active") {
    const settled = await context.admin.rpc("rookline_expire_game", { p_game: id });
    if (settled.error) return NextResponse.json({ error: "Cannot validate clock" }, { status: 503 });
    if (settled.data?.status === "timeout") {
      const latest = await load();
      if (latest.error || !latest.data) return NextResponse.json({ error: "Game unavailable" }, { status: 503 });
      game = latest.data as OnlineGame;
    }
  }
  return NextResponse.json({ game, viewerColor: game.white_id === context.user.id ? "w" : "b" }, { headers: { "Cache-Control": "private, no-store" } });
}
