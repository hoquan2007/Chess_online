import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { analyzeBotPosition } from "./bot";

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

  it("reports a finished position without recommending a move", () => {
    const game = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) game.move(san);
    expect(analyzeBotPosition(game)).toMatchObject({ finished: true, bestMove: null, scoreCp: null });
    expect(game.history()).toHaveLength(4);
    const repetition = new Chess();
    for (let i = 0; i < 4; i++) {
      for (const san of ["Nf3", "Nf6", "Ng1", "Ng8"]) repetition.move(san);
    }
    expect(analyzeBotPosition(repetition)).toMatchObject({ finished: true, bestMove: null, scoreCp: null });
  });
});
