import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { evaluatePuzzleMove, isPuzzleSolution, nextPracticePuzzleIndex, puzzleIndicesForTheme, puzzles, puzzleThemes } from "./puzzles";

describe("original puzzle set", () => {
  it("contains legal, solvable positions", () => {
    expect(puzzles).toHaveLength(10);
    expect(new Set(puzzles.map((item) => item.id)).size).toBe(puzzles.length);
    for (const item of puzzles) {
      const game = new Chess(item.fen);
      expect(game.moves()).toContain(item.solution);
      const move = game.move(item.solution);
      expect(move.san).toBe(item.solution);
      if (item.description.toLowerCase().includes("checkmate in one")) {
        expect(game.isCheckmate()).toBe(true);
      }
    }
  });
  it("rejects a wrong answer", () => expect(isPuzzleSolution("mate-001", "g6", "g4")).toBe(false));
  it("recognizes a tactical solution", () => expect(isPuzzleSolution("tactic-003", "f1", "e2")).toBe(true));
  it("accepts a different valid mate instead of misleading the learner", () => {
    expect(evaluatePuzzleMove("mate-002", "f5", "f8")).toMatchObject({ status: "correct", san: "Qf8#" });
  });
  it("distinguishes illegal and legal but incorrect moves without changing a puzzle", () => {
    expect(evaluatePuzzleMove("mate-004", "e1", "f2")).toEqual({ status: "illegal" });
    expect(evaluatePuzzleMove("mate-004", "e1", "e2")).toEqual({ status: "incorrect" });
    expect(evaluatePuzzleMove("mate-004", "e1", "e8")).toMatchObject({ status: "correct", san: "Re8#" });
    expect(evaluatePuzzleMove("absent", "e1", "e8")).toEqual({ status: "illegal" });
  });
  it("requires correct promotion piece on endgame puzzle", () => {
    expect(evaluatePuzzleMove("endgame-009", "a7", "a8", "n").status).toBe("incorrect");
    expect(evaluatePuzzleMove("endgame-009", "a7", "a8", "q")).toMatchObject({ status: "correct", san: "a8=Q+" });
  });
  it("assigns every puzzle exactly one available practice topic and an explicit level", () => {
    const all = puzzleIndicesForTheme("All");
    expect(all).toEqual(puzzles.map((_, index) => index));
    expect(puzzleThemes.slice(1).flatMap(puzzleIndicesForTheme).sort((a, b) => a - b)).toEqual(all);
    for (const puzzle of puzzles) expect([1, 2, 3]).toContain(puzzle.level);
  });
  it("prioritizes unsolved positions within a topic and cycles after finishing them", () => {
    expect(puzzleIndicesForTheme("Fork")).toEqual([4, 9]);
    expect(nextPracticePuzzleIndex(-1, "Fork", [])).toBe(4);
    expect(nextPracticePuzzleIndex(4, "Fork", ["fork-005"])).toBe(9);
    expect(nextPracticePuzzleIndex(9, "Fork", ["fork-005", "fork-010"])).toBe(4);
    expect(nextPracticePuzzleIndex(9, "All", ["mate-001"])).toBe(1);
  });
});
