import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { completedGameAnalysis, displayedClock, estimatedServerTime, exportOnlinePgn, isOlderGameSnapshot, reconcileServerClockSample, replayGame, type OnlineGame, validSquare, validUuid } from "./games";
import { safeNext } from "./redirect";

function snapshot(override: Partial<OnlineGame> = {}): OnlineGame {
  return {
    id: "00000000-0000-4000-8000-000000000001", white_id: "white-id", black_id: "black-id",
    status: "active", fen: new Chess().fen(), pgn: "", turn: "w", ply: 0,
    base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: "2026-10-29T00:00:00.000Z", result: null, winner_id: null,
    rated: false, created_at: "2026-10-29T00:00:00.000Z", ...override,
  };
}

function played(moves: string[], override: Partial<OnlineGame> = {}): OnlineGame {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  return snapshot({ pgn: chess.pgn(), fen: chess.fen(), ply: moves.length, turn: chess.turn(), ...override });
}

describe("server snapshot replay", () => {
  it("replays the canonical PGN and retains move history", () => {
    const game = new Chess();
    game.move("e4"); game.move("e5"); game.move("Nf3");
    const restored = replayGame(snapshot({ pgn: game.pgn(), fen: game.fen(), ply: 3, turn: game.turn() }));
    expect(restored.fen()).toBe(game.fen());
    expect(restored.history()).toEqual(["e4", "e5", "Nf3"]);
  });
  it("rejects a forged board or move count", () => {
    const game = new Chess(); game.move("e4");
    expect(() => replayGame(snapshot({ pgn: game.pgn(), ply: 1 }))).toThrow("inconsistent");
    expect(() => replayGame(snapshot({ pgn: game.pgn(), fen: game.fen(), ply: 0 }))).toThrow("inconsistent");
  });
  it("rejects an out-of-turn snapshot even when PGN, FEN and ply agree", () => {
    const game = new Chess(); game.move("e4");
    const consistent = snapshot({ pgn: game.pgn(), fen: game.fen(), ply: 1, turn: "b" });
    expect(replayGame(consistent).turn()).toBe("b");
    expect(() => replayGame({ ...consistent, turn: "w" })).toThrow("inconsistent");
  });
  it("rejects malformed SAN and input coordinates", () => {
    expect(() => replayGame(snapshot({ pgn: "this is not PGN" }))).toThrow();
    expect(validSquare("e4")).toBe(true);
    expect(validSquare("z1")).toBe(false);
    expect(validUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(validUuid("../../etc/passwd")).toBe(false);
  });
});

describe("online PGN export", () => {
  it("exports verified moves and the result of a finished game", () => {
    const chess = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
    const online = snapshot({ pgn: chess.pgn(), fen: chess.fen(), ply: 4,
      status: "completed", winner_id: "black-id", result: "Checkmate" });
    const downloaded = exportOnlinePgn(online);
    const restored = new Chess();
    restored.loadPgn(downloaded);
    expect(restored.fen()).toBe(chess.fen());
    expect(restored.getHeaders().Result).toBe("0-1");
    expect(restored.getHeaders().Event).toBe("Rookline online game");
  });

  it("marks ongoing games as unfinished and completed draws as draws", () => {
    const ongoing = exportOnlinePgn(snapshot());
    const ongoingChess = new Chess();
    ongoingChess.loadPgn(ongoing);
    expect(ongoingChess.getHeaders().Result).toBe("*");
    const drawn = new Chess();
    drawn.loadPgn(exportOnlinePgn(snapshot({ status: "completed", result: "Stalemate", winner_id: null })));
    expect(drawn.getHeaders().Result).toBe("1/2-1/2");
  });
});

describe("completed online game analysis", () => {
  const finished = () => {
    const chess = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
    return snapshot({ status: "completed", pgn: chess.pgn(), fen: chess.fen(),
      ply: 4, turn: chess.turn(), result: "Checkmate", winner_id: "black-id" });
  };

  it("reconstructs the canonical completed move sequence and result", () => {
    const loaded = completedGameAnalysis(finished());
    const parsed = new Chess();
    parsed.loadPgn(loaded.pgn);
    expect(loaded.san).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(loaded.start).toBe(new Chess().fen());
    expect(parsed.getHeaders().Result).toBe("0-1");
    expect(parsed.history()).toEqual(loaded.san);
  });

  it("refuses unfinished, corrupted, oversized and unidentifiable game snapshots", () => {
    const valid = finished();
    for (const candidate of [
      { ...valid, status: "active" },
      { ...valid, fen: new Chess().fen() },
      { ...valid, ply: 3 },
      { ...valid, pgn: "illegal move" },
      { ...valid, pgn: "x".repeat(100_001) },
      { ...valid, id: "../../bad" },
      { ...valid, winner_id: 42 },
      { ...valid, winner_id: "unrelated-id" },
      { ...valid, result: null },
      { ...valid, black_id: null },
      { ...valid, turn: "b" },
      { ...valid, white_id: undefined },
      null,
    ]) expect(() => completedGameAnalysis(candidate)).toThrow();
  });
});

describe("clock rendering only", () => {
  it("decreases only the active player's clock, preserving the other", () => {
    const game = snapshot();
    expect(displayedClock(game, Date.parse(game.clock_anchor_at!) + 4000)).toEqual({ w: 296000, b: 300000 });
    expect(displayedClock({ ...game, turn: "b" }, Date.parse(game.clock_anchor_at!) + 4000)).toEqual({ w: 300000, b: 296000 });
  });
  it("clamps zero, ignores negative elapsed time and freezes completed games", () => {
    const game = snapshot({ white_ms: 1200 });
    expect(displayedClock(game, Date.parse(game.clock_anchor_at!) + 5000).w).toBe(0);
    expect(displayedClock(game, Date.parse(game.clock_anchor_at!) - 1000).w).toBe(1200);
    expect(displayedClock({ ...game, status: "completed" }, Date.parse(game.clock_anchor_at!) + 5000).w).toBe(1200);
  });
  it("renders from a server timestamp despite a skewed or adjusted device wall clock", () => {
    const game = snapshot({ clock_anchor_at: "2026-10-29T00:00:00.000Z" });
    const serverNow = Date.parse(game.clock_anchor_at!) + 1000;
    const receivedAt = 3000;
    expect(displayedClock(game, estimatedServerTime(serverNow, receivedAt, 7000)).w).toBe(295000);
    expect(displayedClock(game, estimatedServerTime(serverNow, receivedAt, 2000)).w).toBe(299000);
    // This clock path never reads a possibly incorrect Date.now() from the browser.
  });
  it("keeps the displayed server clock monotonic when HTTP replies arrive late or out of order", () => {
    const first = { serverNow: 200_000, receivedAt: 1_000 };
    const stale = { serverNow: 180_000, receivedAt: 5_000 };
    expect(reconcileServerClockSample(first, stale)).toBe(first);
    const later = reconcileServerClockSample(first, { serverNow: 202_000, receivedAt: 5_000 });
    expect(later).toEqual({ serverNow: 204_000, receivedAt: 5_000 });
    expect(reconcileServerClockSample(later, { serverNow: 203_000, receivedAt: 6_000 })).toBe(later);
    expect(reconcileServerClockSample(null, first)).toEqual(first);
  });
});

describe("out-of-order authoritative snapshots", () => {
  it("rejects delayed responses that would rewind moves or a completed result", () => {
    const active = played(["e4", "e5", "Nf3", "Nc6"]);
    expect(isOlderGameSnapshot(active, played(["e4", "e5", "Nf3"]))).toBe(true);
    expect(isOlderGameSnapshot(active, played(["e4", "e5", "Nf3", "Nc6", "Bc4"]))).toBe(false);
    const completed = { ...active, status: "completed" as const, result: "resignation" };
    expect(isOlderGameSnapshot(completed, active)).toBe(true);
    expect(isOlderGameSnapshot(active, completed)).toBe(false);
    expect(isOlderGameSnapshot(snapshot({ status: "active" }), snapshot({ status: "waiting" }))).toBe(true);
    expect(isOlderGameSnapshot(completed, completed)).toBe(false);
  });
  it("never resurrects a completed or cancelled game despite a higher incoming ply", () => {
    const completed = played(["e4", "e5", "Nf3", "Nc6"], { status: "completed", result: "resignation", winner_id: "black-id" });
    expect(isOlderGameSnapshot(completed, played(["e4", "e5", "Nf3", "Nc6", "Bc4"]))).toBe(true);
    expect(isOlderGameSnapshot(completed, played(["e4", "e5", "Nf3", "Nc6", "Bc4"], { status: "completed" }))).toBe(true);
    expect(isOlderGameSnapshot(completed, played(["e4", "e5", "Nf3", "Nc6"], { status: "cancelled" }))).toBe(true);

    const cancelled = snapshot({ ply: 0, status: "cancelled" });
    expect(isOlderGameSnapshot(cancelled, played(["e4"]))).toBe(true);
    expect(isOlderGameSnapshot(cancelled, snapshot({ ply: 0, status: "completed" }))).toBe(true);
    expect(isOlderGameSnapshot(cancelled, cancelled)).toBe(false);

    expect(isOlderGameSnapshot(played(["e4", "e5"]), played(["e4", "e5", "Nf3"], { status: "waiting" }))).toBe(true);
    expect(isOlderGameSnapshot(played(["e4", "e5"]), played(["e4", "e5", "Nf3"], { status: "completed" }))).toBe(false);
  });
  it("keeps the entire committed terminal record stable across repeated HTTP replies", () => {
    const completed = snapshot({ status: "completed", result: "Resignation", winner_id: "black-id", clock_anchor_at: null });
    const cancelled = snapshot({ status: "cancelled", black_id: null, clock_anchor_at: null });
    expect(isOlderGameSnapshot(completed, { ...completed })).toBe(false);
    expect(isOlderGameSnapshot(cancelled, { ...cancelled })).toBe(false);
    expect(isOlderGameSnapshot(completed, Object.fromEntries(Object.entries(completed).reverse()) as OnlineGame)).toBe(false);
    for (const changed of [
      { ...completed, result: "Checkmate" },
      { ...completed, winner_id: "white-id" },
      { ...completed, fen: "corrupted FEN" },
      { ...completed, pgn: "1. e4" },
      { ...completed, turn: "b" as const },
      { ...completed, white_ms: 0 },
      { ...completed, black_ms: 0 },
      { ...completed, white_id: "another-player" },
      { ...completed, created_at: "2026-10-29T01:00:00.000Z" },
      { ...completed, rated: true },
      { ...completed, id: "00000000-0000-4000-8000-000000000002" },
      { ...cancelled, black_id: "black-id" },
      { ...cancelled, result: "Unexpected result" },
    ]) expect(isOlderGameSnapshot(changed.status === "cancelled" ? cancelled : completed, changed)).toBe(true);
    expect(isOlderGameSnapshot(snapshot(), snapshot({ id: "00000000-0000-4000-8000-000000000002" }))).toBe(true);
  });
  it("rejects contradictory waiting and active replies at the same ply", () => {
    const active = played(["e4", "e5", "Nf3", "Nc6"], { white_ms: 211000, black_ms: 229000 });
    const waiting = snapshot({ status: "waiting", black_id: null, clock_anchor_at: null });
    expect(isOlderGameSnapshot(active, { ...active })).toBe(false);
    expect(isOlderGameSnapshot(waiting, { ...waiting })).toBe(false);
    for (const changed of [
      { ...active, fen: "corrupted" },
      { ...active, pgn: "1. e4" },
      { ...active, white_ms: 0 },
      { ...active, black_ms: 0 },
      { ...active, clock_anchor_at: "2026-10-29T03:00:00.000Z" },
      { ...active, rated: true },
      { ...active, black_id: "unexpected-player" },
    ]) expect(isOlderGameSnapshot(active, changed)).toBe(true);
    expect(isOlderGameSnapshot(waiting, { ...waiting, white_ms: 0 })).toBe(true);
    expect(isOlderGameSnapshot(waiting, snapshot({ status: "active" }))).toBe(false);
    expect(isOlderGameSnapshot(active, { ...active, status: "completed", result: "Resignation", winner_id: "black-id" })).toBe(false);
    expect(isOlderGameSnapshot(active, played(["e4", "e5", "Nf3", "Nc6", "Bc4"]))).toBe(false);
    const chess = new Chess(); chess.move("e4");
    const valid = snapshot({ ply: 1, fen: chess.fen(), pgn: chess.pgn(), turn: "b" });
    const corrupt = { ...valid, pgn: "" };
    expect(isOlderGameSnapshot(valid, corrupt)).toBe(true);
    expect(isOlderGameSnapshot(corrupt, valid)).toBe(false);
    expect(isOlderGameSnapshot(corrupt, { ...valid, pgn: "1. f4" })).toBe(true);
  });
  it("rejects forged future plies and divergent valid histories, then accepts the real continuation", () => {
    const accepted = played(["e4"]);
    const next = played(["e4", "e5"]);
    const forged = [
      { ...next, ply: 90 },
      { ...next, pgn: accepted.pgn },
      { ...next, fen: accepted.fen },
      { ...next, turn: "b" as const },
      { ...next, pgn: "invalid PGN" },
      { ...next, status: "completed" as const, ply: 90 },
      played(["d4", "d5"]),
    ];
    for (const response of forged) expect(isOlderGameSnapshot(accepted, response)).toBe(true);
    expect(isOlderGameSnapshot(accepted, next)).toBe(false);
    expect(isOlderGameSnapshot(next, played(["e4", "e5", "Nf3"]))).toBe(false);
    expect(isOlderGameSnapshot(next, { ...next, status: "completed", result: "Resignation" })).toBe(false);
    expect(isOlderGameSnapshot(next, { ...next, status: "completed", fen: "invalid" })).toBe(true);
  });
  it("rejects identity and time-control rewrites during a legitimate move or lifecycle transition", () => {
    const waiting = snapshot({ status: "waiting", black_id: null, clock_anchor_at: null });
    const active = snapshot();
    const completed = { ...active, status: "completed" as const, result: "Resignation", winner_id: "black-id", clock_anchor_at: null };
    expect(isOlderGameSnapshot(waiting, active)).toBe(false);
    expect(isOlderGameSnapshot(active, completed)).toBe(false);
    expect(isOlderGameSnapshot(active, played(["e4"]))).toBe(false);
    expect(isOlderGameSnapshot(waiting, { ...active, black_id: null })).toBe(true);
    for (const changed of [
      { white_id: "other-white" },
      { rated: true },
      { created_at: "2026-10-30T00:00:00.000Z" },
      { base_ms: 600000 },
      { increment_ms: 1000 },
    ]) {
      expect(isOlderGameSnapshot(active, { ...completed, ...changed })).toBe(true);
      expect(isOlderGameSnapshot(active, { ...played(["e4"]), ...changed })).toBe(true);
      expect(isOlderGameSnapshot(waiting, { ...active, ...changed })).toBe(true);
    }
    expect(isOlderGameSnapshot(active, { ...completed, black_id: "other-black" })).toBe(true);
    expect(isOlderGameSnapshot(active, { ...completed, winner_id: "outsider" })).toBe(true);
  });
});

describe("auth redirects", () => {
  it("keeps safe local paths", () => expect(safeNext("/game/abc?view=1")).toBe("/game/abc?view=1"));
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null])("rejects external or malformed destination %s", (value) => {
    expect(safeNext(value)).toBe("/play/online");
  });
});
