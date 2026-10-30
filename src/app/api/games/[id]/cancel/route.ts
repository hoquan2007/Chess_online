import { NextResponse } from "next/server";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { validUuid } from "@/lib/online/games";
import { gameMutationLimit } from "@/lib/online/rate-limit";
import { rejectCrossOrigin } from "@/lib/online/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const limited = await gameMutationLimit(context.admin, context.user.id, "cancel");
  if (limited) return limited;
  const { data, error } = await context.admin.rpc("rookline_cancel_challenge", {
    p_game: id, p_player: context.user.id,
  });
  if (error) return NextResponse.json({ error: "Challenge cannot be cancelled" }, { status: 409 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
