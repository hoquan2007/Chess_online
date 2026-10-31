import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { analyzeBotPosition, chooseBotMove } from "./bot";

describe("computer move selection", () => {
  it("develops a central pawn or knight in the opening on each search level", () => {
    const game = new Chess();
    const fen = game.fen();
    for (const level of ["medium", "hard", "advanced"] as const) {
      const move = chooseBotMove(game, level);
      expect(["d4", "e4", "Nf3", "Nc3"]).toContain(move?.san);
      expect(game.fen()).toBe(fen);
      expect(game.history()).toEqual([]);
    }
  });

  it("prefers a forced mate over positional gains without mutating the game", () => {
    const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const fen = game.fen();
    for (const level of ["medium", "hard", "advanced"] as const) {
      expect(chooseBotMove(game, level)?.san).toMatch(/#$/);
      expect(game.fen()).toBe(fen);
    }
  });

  it("does not grab a defended pawn when it immediately loses the queen", () => {
    // Qxf5 wins a pawn in static evaluation, but the rook on f8 takes the queen.
    const game = new Chess("5rk1/8/6n1/5p2/4Q3/8/8/6K1 w - - 0 1");
    const fen = game.fen();
    expect(chooseBotMove(game, "medium")?.san).not.toBe("Qxf5");
    expect(game.fen()).toBe(fen);
  });
});

describe("original analysis hint", () => {
  it("offers a legal move without mutating the imported position", () => {
    const game = new Chess();
    for (const san of ["e4", "e5", "Nf3"]) game.move(san);
    const fen = game.fen();
    const history = game.history();
    const hint = analyzeBotPosition(game);
    expect(hint.finished).toBe(false);
    expect(hint.depth).toBe(2);
    expect(hint.bestMove).not.toBeNull();
    expect(hint.candidates).toHaveLength(3);
    expect(hint.candidates[0]).toMatchObject({ ...hint.bestMove, scoreCp: hint.scoreCp });
    for (const candidate of hint.candidates) expect(game.moves()).toContain(candidate.san);
    expect(hint.candidates.every((candidate) => Number.isFinite(candidate.scoreCp))).toBe(true);
    expect(hint.candidates.slice(1).every((candidate) =>
      game.turn() === "w" ? candidate.scoreCp <= hint.candidates[0].scoreCp : candidate.scoreCp >= hint.candidates[0].scoreCp)).toBe(true);
    expect(game.moves()).toContain(hint.bestMove?.san);
    expect(game.fen()).toBe(fen);
    expect(game.history()).toEqual(history);
    expect(Number.isFinite(hint.scoreCp)).toBe(true);
  });

  it("finds an immediate free queen capture and preserves the side-to-move perspective", () => {
    const white = new Chess("4k3/8/8/8/4q3/8/4R3/4K3 w - - 0 1");
    const hint = analyzeBotPosition(white);
    expect(hint.bestMove?.san).toBe("Rxe4+");
    expect(hint.scoreCp).toBeGreaterThan(0);
    const black = new Chess("4k3/4r3/8/4Q3/8/8/8/4K3 b - - 0 1");
    const blackHint = analyzeBotPosition(black);
    expect(blackHint.bestMove?.san).toBe("Rxe5+");
    expect(blackHint.scoreCp).toBeLessThan(0);
  });

  it("provides legal opponent replies to explored candidates and omits replies to checkmate", () => {
    const position = new Chess();
    const before = position.fen();
    const hint = analyzeBotPosition(position);
    expect(hint.candidates).toHaveLength(3);
    for (const candidate of hint.candidates) {
      const continuation = new Chess(before);
      continuation.move(candidate.san);
      expect(candidate.replySan).not.toBeNull();
      expect(continuation.moves()).toContain(candidate.replySan);
      continuation.move(candidate.replySan!);
    }
    expect(analyzeBotPosition(position)).toEqual(hint);
    expect(position.fen()).toBe(before);

    const mateInOne = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const mateHint = analyzeBotPosition(mateInOne);
    expect(mateHint.bestMove?.san).toMatch(/#$/);
    expect(mateHint.candidates[0].replySan).toBeNull();
    expect(mateInOne.fen()).toBe("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
  });

  it("reports a finished position without recommending a move", () => {
    const game = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) game.move(san);
    expect(analyzeBotPosition(game)).toMatchObject({ finished: true, bestMove: null, scoreCp: null, candidates: [] });
    expect(game.history()).toHaveLength(4);
    const repetition = new Chess();
    for (let i = 0; i < 4; i++) {
      for (const san of ["Nf3", "Nf6", "Ng1", "Ng8"]) repetition.move(san);
    }
    expect(analyzeBotPosition(repetition)).toMatchObject({ finished: true, bestMove: null, scoreCp: null });
  });
});
