import { validUuid } from "./games";

export const HISTORY_PAGE_SIZE = 50;

export type GameHistoryEntry = {
  id: string;
  white_id: string;
  black_id: string | null;
  base_ms: number;
  increment_ms: number;
  status: string;
  result: string | null;
  winner_id: string | null;
  ply: number;
  created_at: string;
};

type Cursor = { created_at: string; id: string };

// Keep PostgreSQL's exact microsecond timestamp. Converting through Date would
// round the cursor and omit games created during the same millisecond.
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function decodeHistoryCursor(value: string | null): Cursor | null {
  if (value === null) return null;
  if (value.length < 8 || value.length > 220 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid history cursor");
  try {
    const cursor: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!cursor || typeof cursor !== "object" || !("id" in cursor) || !("created_at" in cursor) ||
      typeof cursor.id !== "string" || !validUuid(cursor.id) ||
      typeof cursor.created_at !== "string" || !timestampPattern.test(cursor.created_at) ||
      !Number.isFinite(Date.parse(cursor.created_at))) throw new Error("Invalid cursor");
    return { id: cursor.id, created_at: cursor.created_at };
  } catch {
    throw new Error("Invalid history cursor");
  }
}

export function encodeHistoryCursor(entry: Pick<GameHistoryEntry, "id" | "created_at">) {
  return Buffer.from(JSON.stringify({ id: entry.id, created_at: entry.created_at })).toString("base64url");
}

/** Every branch includes the authenticated user so the privileged query never
 * fetches other players' games, including at an equal timestamp boundary. */
export function historyMembershipFilter(userId: string, cursor: Cursor | null) {
  if (!validUuid(userId)) throw new Error("Invalid user identifier");
  if (!cursor) return `white_id.eq.${userId},black_id.eq.${userId}`;
  const date = cursor.created_at;
  const id = cursor.id;
  return ["white_id", "black_id"].flatMap((seat) => [
    `and(${seat}.eq.${userId},created_at.lt.${date})`,
    `and(${seat}.eq.${userId},created_at.eq.${date},id.lt.${id})`,
  ]).join(",");
}
