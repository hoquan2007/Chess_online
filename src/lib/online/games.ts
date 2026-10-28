import { Chess } from "chess.js";

export const timeControls = {
  "3+2": { base_ms: 180000, increment_ms: 2000 },
  "5+0": { base_ms: 300000, increment_ms: 0 },
  "10+0": { base_ms: 600000, increment_ms: 0 },
} as const;
export type TimeControl = keyof typeof timeControls;

export type OnlineGame = {
  id: string;
  white_id: string;
  black_id: string | null;
  status: "waiting" | "active" | "completed" | "cancelled";
  fen: string;
  pgn: string;
  turn: "w" | "b";
  ply: number;
  base_ms: number;
  increment_ms: number;
  white_ms: number;
  black_ms: number;
  clock_anchor_at: string | null;
  result: string | null;
  winner_id: string | null;
  rated: boolean;
  created_at: string;
};

export const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const validSquare = (value: unknown): value is string => typeof value === "string" && /^[a-h][1-8]$/.test(value);

/** Avoid applying an older HTTP response after a newer move or game termination.
 * A game can only advance in ply, then in lifecycle phase at the same ply.
 */
export function isOlderGameSnapshot(current: OnlineGame, incoming: OnlineGame) {
  if (current.id !== incoming.id) return false;
  if (incoming.ply !== current.ply) return incoming.ply < current.ply;
  const phase: Record<OnlineGame["status"], number> = {
    waiting: 0, active: 1, completed: 2, cancelled: 2,
  };
  return phase[incoming.status] < phase[current.status];
}

/** Rebuild from the server's canonical, durable PGN to preserve repetition history. */
export function replayGame(snapshot: Pick<OnlineGame, "pgn" | "fen" | "ply">) {
  const chess = new Chess();
  if (snapshot.pgn) chess.loadPgn(snapshot.pgn);
  if (chess.fen() !== snapshot.fen || chess.history().length !== snapshot.ply) throw new Error("Game ledger is inconsistent");
  return chess;
}

/** For display only. The actual winner is decided in a Postgres transaction. */
export function displayedClock(game: OnlineGame, nowMs: number) {
  let white = game.white_ms;
  let black = game.black_ms;
  if (game.status === "active" && game.clock_anchor_at) {
    const elapsed = Math.max(0, nowMs - Date.parse(game.clock_anchor_at));
    if (game.turn === "w") white = Math.max(0, white - elapsed);
    else black = Math.max(0, black - elapsed);
  }
  return { w: white, b: black };
}
