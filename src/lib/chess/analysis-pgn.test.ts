import { describe, expect, it } from "vitest";
import { parseAnalysisPgn, maxAnalysisPgnBytes } from "./analysis-pgn";

describe("analysis PGN file input", () => {
  it("imports standard and setup positions with move history and headers", () => {
    const game = parseAnalysisPgn("\uFEFF[Event \"Practice\"]\n\n1. e4 e5 2. Nf3 *");
    expect(game.san).toEqual(["e4", "e5", "Nf3"]);
    expect(game.pgn).toContain('[Event "Practice"]');
    const custom = parseAnalysisPgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. O-O *');
    expect(custom.start).toBe("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(custom.san).toEqual(["O-O"]);
  });

  it("rejects malformed, empty and oversized content before parsing", () => {
    for (const text of ["", "not a chess game", "1. e4 e5 2. impossible", "x".repeat(maxAnalysisPgnBytes + 1)]) {
      expect(() => parseAnalysisPgn(text)).toThrow();
    }
    expect(() => parseAnalysisPgn("é".repeat(maxAnalysisPgnBytes / 2 + 1))).toThrow("32 KB");
  });
});
