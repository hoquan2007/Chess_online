import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeHistoryCursor, historyMembershipFilter, HISTORY_PAGE_SIZE } from "./history";

export async function loadGameHistory(admin: SupabaseClient, userId: string, cursor: { id: string; created_at: string } | null) {
  const { data, error } = await admin.from("games")
    .select("id,white_id,black_id,base_ms,increment_ms,status,result,winner_id,ply,created_at")
    .or(historyMembershipFilter(userId, cursor))
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(HISTORY_PAGE_SIZE + 1);
  if (error) throw new Error("Could not load games");
  const games = (data ?? []).slice(0, HISTORY_PAGE_SIZE);
  return { games, nextCursor: (data?.length ?? 0) > HISTORY_PAGE_SIZE ? encodeHistoryCursor(games[games.length - 1]) : null };
}
