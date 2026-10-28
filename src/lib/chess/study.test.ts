import { describe, expect, it } from "vitest";
import { lessonLines, openingLines, studyPosition } from "./study";

describe("original instructional lines", () => {
  it("every documented move is legal and step descriptions align with positions", () => {
    for (const line of [...openingLines, ...lessonLines]) {
      expect(line.steps).toHaveLength(line.moves.length);
      expect(studyPosition(line.moves, line.moves.length).history()).toEqual([...line.moves]);
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
});
