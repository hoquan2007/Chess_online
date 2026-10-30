import { NextResponse } from "next/server";
import type { adminSupabase } from "@/lib/supabase/server";

type Admin = NonNullable<ReturnType<typeof adminSupabase>>;
type Action = "create" | "join" | "move" | "resign" | "claim" | "cancel";
const limits: Record<Action, { max: number; period: number }> = {
  create: { max: 6, period: 60 },
  join: { max: 12, period: 60 },
  move: { max: 40, period: 10 },
  resign: { max: 8, period: 60 },
  claim: { max: 8, period: 60 },
  cancel: { max: 12, period: 60 },
};

/** Null means allowed; a response means reject the request before its mutation. */
export async function gameMutationLimit(admin: Admin, userId: string, action: Action): Promise<NextResponse | null> {
  const limit = limits[action];
  const { data, error } = await admin.rpc("rookline_consume_game_limit", {
    p_user: userId, p_action: action, p_max: limit.max, p_period_seconds: limit.period,
  });
  if (error || typeof data !== "boolean") {
    return NextResponse.json({ error: "Rate limiter unavailable" }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Too many requests; retry shortly" }, {
      status: 429, headers: { "Retry-After": String(limit.period) },
    });
  }
  return null;
}
