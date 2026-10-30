import { describe, expect, it } from "vitest";
import { evaluatePracticeMove, lessonLines, openingLines, practiceNextPly, studyPosition } from "./study";

describe("original instructional lines", () => {
  it("every documented move is legal and step descriptions align with positions", () => {
    expect(openingLines).toHaveLength(10);
    expect(lessonLines).toHaveLength(5);
    expect(new Set([...openingLines, ...lessonLines].map((line) => line.id)).size).toBe(15);
    for (const line of [...openingLines, ...lessonLines]) {
      expect(line.steps).toHaveLength(line.moves.length);
      expect(studyPosition(line.moves, line.moves.length).history()).toEqual([...line.moves]);
    }
  });
  it("all fifteen lines are completable from either side using only legal moves", () => {
    for (const line of [...openingLines, ...lessonLines]) {
      for (const side of ["w", "b"] as const) {
        let ply = practiceNextPly(line, side, 0);
        let learnerMoves = 0;
        while (ply < line.moves.length) {
          const game = studyPosition(line.moves, ply);
          const expected = game.moves({ verbose: true }).find((move) => move.san === line.moves[ply]);
          expect(expected, `${line.id} at ply ${ply}`).toBeDefined();
          const promotion = expected!.promotion;
          const result = evaluatePracticeMove(line, side, ply, {
            from: expected!.from, to: expected!.to,
            promotion: promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n" ? promotion : undefined,
          });
          expect(result.status).toBe("correct");
          expect(result.ply).toBeGreaterThan(ply);
          ply = result.ply;
          learnerMoves++;
        }
        expect(learnerMoves).toBeGreaterThan(0);
        expect(ply).toBe(line.moves.length);
      }
    }
  });
  it("rewinds without changing the canonical opening position", () => {
    expect(studyPosition(openingLines[0].moves, 0).history()).toHaveLength(0);
    expect(studyPosition(openingLines[0].moves, 3).history()).toEqual(["e4", "e5", "Nf3"]);
  });
  it("rejects out-of-range moves and malformed lines", () => {
    expect(() => studyPosition(["e4"], 2)).toThrow("Invalid study position");
    expect(() => studyPosition(["not-a-move"], 1)).toThrow();
  });
  it("practices a white opening while the scripted black side responds", () => {
    const line = openingLines[0];
    expect(practiceNextPly(line, "w", 0)).toBe(0);
    expect(evaluatePracticeMove(line, "w", 0, { from: "e2", to: "e5" })).toEqual({ status: "illegal", ply: 0 });
    expect(evaluatePracticeMove(line, "w", 0, { from: "d2", to: "d4" })).toEqual({ status: "off-line", ply: 0 });
    const first = evaluatePracticeMove(line, "w", 0, { from: "e2", to: "e4" });
    expect(first).toEqual({ status: "correct", ply: 2, san: "e4" });
    expect(studyPosition(line.moves, first.ply).history()).toEqual(["e4", "e5"]);
    expect(evaluatePracticeMove(line, "w", 2, { from: "g1", to: "f3" })).toEqual({ status: "correct", ply: 4, san: "Nf3" });
    expect(evaluatePracticeMove(line, "w", 4, { from: "f1", to: "c4" })).toEqual({ status: "correct", ply: 6, san: "Bc4" });
    expect(evaluatePracticeMove(line, "w", 6, { from: "a2", to: "a3" })).toEqual({ status: "finished", ply: 6 });
    expect(line.moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]);
  });
  it("practices as black after an automatic white opening and guards turns", () => {
    const line = openingLines[0];
    const first = practiceNextPly(line, "b", 0);
    expect(first).toBe(1);
    expect(studyPosition(line.moves, first).history()).toEqual(["e4"]);
    expect(evaluatePracticeMove(line, "b", first, { from: "e7", to: "e5" })).toEqual({ status: "correct", ply: 3, san: "e5" });
    expect(evaluatePracticeMove(line, "b", 3, { from: "b8", to: "c6" })).toEqual({ status: "correct", ply: 5, san: "Nc6" });
    expect(evaluatePracticeMove(line, "b", 5, { from: "f8", to: "c5" })).toEqual({ status: "correct", ply: 6, san: "Bc5" });
    expect(() => evaluatePracticeMove(line, "b", 0, { from: "e2", to: "e4" })).toThrow("Invalid practice turn");
    expect(() => evaluatePracticeMove(line, "b", -1, { from: "e7", to: "e5" })).toThrow("Invalid practice turn");
  });
});
