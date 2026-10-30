import { NextResponse } from "next/server";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { timeControls, type TimeControl } from "@/lib/online/games";
import { readLimitedJson } from "@/lib/online/request-json";
import { gameMutationLimit } from "@/lib/online/rate-limit";
import { rejectCrossOrigin } from "@/lib/online/request-origin";
import { decodeHistoryCursor } from "@/lib/online/history";
import { loadGameHistory } from "@/lib/online/history-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  let cursor;
  try { cursor = decodeHistoryCursor(new URL(request.url).searchParams.get("cursor")); }
  catch { return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 }); }
  try {
    const history = await loadGameHistory(context.admin, context.user.id, cursor);
    return NextResponse.json(history, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Could not load games" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedGameContext();
  if (!context.user || !context.admin) return NextResponse.json({ error: context.error }, { status: context.status });
  const parsed = await readLimitedJson(request, 2048);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  const control = typeof body === "object" && body !== null && "control" in body ? body.control : "5+0";
  if (typeof control !== "string" || !Object.hasOwn(timeControls, control)) return NextResponse.json({ error: "Unsupported time control" }, { status: 422 });
  const limited = await gameMutationLimit(context.admin, context.user.id, "create");
  if (limited) return limited;
  const { base_ms, increment_ms } = timeControls[control as TimeControl];
  const { data, error } = await context.admin.from("games").insert({
    white_id: context.user.id, base_ms, increment_ms, white_ms: base_ms, black_ms: base_ms,
    status: "waiting", rated: false,
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Unable to create challenge" }, { status: 503 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
