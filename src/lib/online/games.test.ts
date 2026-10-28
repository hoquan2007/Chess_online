import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { displayedClock, isOlderGameSnapshot, replayGame, type OnlineGame, validSquare, validUuid } from "./games";
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
