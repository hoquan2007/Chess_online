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

describe("server snapshot replay", () => {
  it("replays the canonical PGN and retains move history", () => {
    const game = new Chess();
    game.move("e4"); game.move("e5"); game.move("Nf3");
    const restored = replayGame(snapshot({ pgn: game.pgn(), fen: game.fen(), ply: 3 }));
    expect(restored.fen()).toBe(game.fen());
    expect(restored.history()).toEqual(["e4", "e5", "Nf3"]);
  });
  it("rejects a forged board or move count", () => {
    const game = new Chess(); game.move("e4");
    expect(() => replayGame(snapshot({ pgn: game.pgn(), ply: 1 }))).toThrow("inconsistent");
    expect(() => replayGame(snapshot({ pgn: game.pgn(), fen: game.fen(), ply: 0 }))).toThrow("inconsistent");
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
    const active = snapshot({ ply: 4 });
    expect(isOlderGameSnapshot(active, snapshot({ ply: 3 }))).toBe(true);
    expect(isOlderGameSnapshot(active, snapshot({ ply: 5 }))).toBe(false);
    const completed = snapshot({ ply: 4, status: "completed", result: "resignation" });
    expect(isOlderGameSnapshot(completed, active)).toBe(true);
    expect(isOlderGameSnapshot(active, completed)).toBe(false);
    expect(isOlderGameSnapshot(snapshot({ status: "active" }), snapshot({ status: "waiting" }))).toBe(true);
    expect(isOlderGameSnapshot(completed, completed)).toBe(false);
  });
});

describe("auth redirects", () => {
  it("keeps safe local paths", () => expect(safeNext("/game/abc?view=1")).toBe("/game/abc?view=1"));
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null])("rejects external or malformed destination %s", (value) => {
    expect(safeNext(value)).toBe("/play/online");
  });
});
