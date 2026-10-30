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
  // A committed terminal game cannot resume, change terminal kind or gain
  // moves. Reject contradictory responses even if their ply is higher.
  if (current.status === "completed" || current.status === "cancelled") {
    return incoming.status !== current.status || incoming.ply !== current.ply;
  }
  const phase: Record<OnlineGame["status"], number> = {
    waiting: 0, active: 1, completed: 2, cancelled: 2,
  };
  if (phase[incoming.status] < phase[current.status]) return true;
  return incoming.ply < current.ply;
}

/** Rebuild from the server's canonical, durable PGN to preserve repetition history. */
export function replayGame(snapshot: Pick<OnlineGame, "pgn" | "fen" | "ply" | "turn">) {
  const chess = new Chess();
  if (snapshot.pgn) chess.loadPgn(snapshot.pgn);
  if (chess.fen() !== snapshot.fen || chess.history().length !== snapshot.ply || chess.turn() !== snapshot.turn) {
    throw new Error("Game ledger is inconsistent");
  }
  return chess;
}

/** Export a verified authoritative ledger with a standard, parseable PGN result. */
export function exportOnlinePgn(snapshot: OnlineGame) {
  const chess = replayGame(snapshot);
  const result = snapshot.status !== "completed" ? "*" :
    snapshot.winner_id === snapshot.white_id ? "1-0" :
    snapshot.winner_id && snapshot.winner_id === snapshot.black_id ? "0-1" : "1/2-1/2";
  chess.setHeader("Event", "Rookline online game");
  chess.setHeader("Site", "Rookline");
  chess.setHeader("Result", result);
  return chess.pgn();
}

/** Convert a finished, server-authorized game to a locally replayable analysis.
 * Reject inconsistent or oversized ledgers before they reach the analysis UI.
 */
export function completedGameAnalysis(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid game snapshot");
  const game = value as Partial<OnlineGame>;
  if (game.status !== "completed" || !validUuid(game.id ?? "") ||
      typeof game.pgn !== "string" || game.pgn.length > 100_000 ||
      typeof game.fen !== "string" || game.fen.length > 120 ||
      !Number.isSafeInteger(game.ply) || (game.ply ?? -1) < 0 || (game.ply ?? 0) > 30_000 ||
      typeof game.white_id !== "string" || !game.white_id ||
      typeof game.black_id !== "string" || !game.black_id ||
      typeof game.result !== "string" || !game.result || game.result.length > 200 ||
      (game.winner_id !== null && game.winner_id !== game.white_id && game.winner_id !== game.black_id) ||
      (game.turn !== "w" && game.turn !== "b")) {
    throw new Error("Invalid or unfinished game snapshot");
  }
  const validated = game as OnlineGame;
  const pgn = exportOnlinePgn(validated);
  const chess = new Chess();
  chess.loadPgn(pgn);
  if (chess.turn() !== validated.turn) throw new Error("Inconsistent game turn");
  const san = chess.history();
  return { start: chess.header().FEN || new Chess().fen(), san, pgn };
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

/** Advance a server-clock sample with monotonic browser time, independent of Date.now skew or wall-clock jumps. */
export function estimatedServerTime(serverNowMs: number, receivedAtMonotonicMs: number, currentMonotonicMs: number) {
  return serverNowMs + Math.max(0, currentMonotonicMs - receivedAtMonotonicMs);
}

export type ServerClockSample = { serverNow: number; receivedAt: number };

/** A delayed or out-of-order HTTP sample must not rewind a running display clock.
 * The server still decides every move and timeout; this only controls interpolation.
 */
export function reconcileServerClockSample(previous: ServerClockSample | null, incoming: ServerClockSample) {
  if (!previous) return incoming;
  if (incoming.serverNow <= previous.serverNow) return previous;
  return {
    serverNow: Math.max(incoming.serverNow, estimatedServerTime(previous.serverNow, previous.receivedAt, incoming.receivedAt)),
    receivedAt: incoming.receivedAt,
  };
}
