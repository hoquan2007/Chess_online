import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { evaluatePuzzleMove, isPuzzleSolution, nextAdaptivePuzzleIndex, nextPracticePuzzleIndex, puzzleIndicesForTheme, puzzles, puzzleThemes, readPuzzlePractice, recordPuzzlePractice } from "./puzzles";

describe("original puzzle set", () => {
  it("contains legal, solvable positions", () => {
    expect(puzzles).toHaveLength(20);
    expect(new Set(puzzles.map((item) => item.id)).size).toBe(puzzles.length);
    for (const item of puzzles) {
      const game = new Chess(item.fen);
      expect(game.moves()).toContain(item.solution);
      const move = game.move(item.solution);
      expect(move.san).toBe(item.solution);
      if (item.goal === "mate") {
        expect(game.isCheckmate()).toBe(true);
      } else {
        expect(game.isCheckmate()).toBe(false);
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
  it("solves newly authored Black-to-move tactics and both promotions", () => {
    for (const id of ["mate-012", "fork-013", "capture-017", "promotion-018"]) {
      const puzzle = puzzles.find((item) => item.id === id)!;
      const position = new Chess(puzzle.fen);
      expect(position.turn()).toBe("b");
      const correctMove = position.moves({ verbose: true }).find((move) => move.san === puzzle.solution)!;
      const promotion = correctMove.promotion;
      expect(evaluatePuzzleMove(id, correctMove.from, correctMove.to,
        promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
      )).toMatchObject({
        status: "correct", san: puzzle.solution,
      });
    }
    expect(evaluatePuzzleMove("promotion-018", "e2", "e1", "n").status).toBe("incorrect");
    expect(evaluatePuzzleMove("promotion-019", "g7", "g8", "q")).toMatchObject({ status: "correct" });
  });
  it("assigns every puzzle exactly one available practice topic and an explicit level", () => {
    const all = puzzleIndicesForTheme("All");
    expect(all).toEqual(puzzles.map((_, index) => index));
    expect(puzzleThemes.slice(1).flatMap(puzzleIndicesForTheme).sort((a, b) => a - b)).toEqual(all);
    for (const puzzle of puzzles) expect([1, 2, 3]).toContain(puzzle.level);
  });
  it("prioritizes unsolved positions within a topic and cycles after finishing them", () => {
    expect(puzzleIndicesForTheme("Fork")).toEqual([4, 9, 12, 13]);
    expect(nextPracticePuzzleIndex(-1, "Fork", [])).toBe(4);
    expect(nextPracticePuzzleIndex(4, "Fork", ["fork-005"])).toBe(9);
    expect(nextPracticePuzzleIndex(9, "Fork", ["fork-005", "fork-010"])).toBe(12);
    expect(nextPracticePuzzleIndex(13, "Fork", ["fork-005", "fork-010", "fork-013", "fork-014"])).toBe(4);
    expect(nextPracticePuzzleIndex(9, "All", ["mate-001"])).toBe(10);
    expect(nextPracticePuzzleIndex(19, "All", ["mate-001"])).toBe(1);
  });
  it("sanitizes tampered practice history and bounds counters", () => {
    const stored = readPuzzlePractice({
      "fork-005": { errors: 4, hints: -10, solves: "2" },
      "fork-010": { errors: 10000000, hints: 1, solves: 0 },
      unknown: { errors: 30, hints: 20, solves: 10 },
    });
    expect(stored).toEqual({
      "fork-005": { errors: 4, hints: 0, solves: 0 },
      "fork-010": { errors: 0, hints: 1, solves: 0 },
    });
    expect(readPuzzlePractice(["invalid"])).toEqual({});
    expect(recordPuzzlePractice(stored, "missing", "solve")).toBe(stored);
    expect(recordPuzzlePractice({ "fork-005": { errors: 9999, hints: 0, solves: 0 } }, "fork-005", "error")["fork-005"].errors).toBe(9999);
  });
  it("adapts review to actual mistakes and hints, rotating after mastery", () => {
    let practice = readPuzzlePractice({});
    for (let i = 0; i < 4; i++) practice = recordPuzzlePractice(practice, "fork-005", "error");
    practice = recordPuzzlePractice(practice, "fork-005", "hint");
    practice = recordPuzzlePractice(practice, "fork-005", "solve");
    expect(nextPracticePuzzleIndex(-1, "Fork", ["fork-005"])).toBe(9);
    expect(nextAdaptivePuzzleIndex(-1, "Fork", ["fork-005"], practice)).toBe(4);
    expect(nextAdaptivePuzzleIndex(4, "Fork", ["fork-005"], practice)).toBe(9);
    for (let i = 0; i < 3; i++) practice = recordPuzzlePractice(practice, "fork-005", "solve");
    expect(nextAdaptivePuzzleIndex(-1, "Fork", ["fork-005"], practice)).toBe(9);
    expect(nextAdaptivePuzzleIndex(-1, "Pin", [], {})).toBe(5);
  });
});
