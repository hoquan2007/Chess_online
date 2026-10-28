import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { isPuzzleSolution, puzzles } from "./puzzles";

describe("original puzzle set", () => {
  it("contains legal, solvable positions", () => {
    for (const item of puzzles) {
      const game = new Chess(item.fen);
      expect(game.moves()).toContain(item.solution);
    }
  });
  it("rejects a wrong answer", () => expect(isPuzzleSolution("mate-001", "g6", "g4")).toBe(false));
  it("recognizes a tactical solution", () => expect(isPuzzleSolution("tactic-003", "f1", "e2")).toBe(true));
});
