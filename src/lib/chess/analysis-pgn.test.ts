import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { parseAnalysisPgn, maxAnalysisPgnBytes, exportAnalysisVariation } from "./analysis-pgn";

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

  it("preserves event and player headers when branching while clearing the obsolete result", () => {
    const imported = parseAnalysisPgn('[Event "Club"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. d4 d5 2. c4 1-0');
    const variation = exportAnalysisVariation(imported.start, ["d4", "d5", "Nf3"], imported.headers);
    const parsed = parseAnalysisPgn(variation);
    expect(parsed.headers).toMatchObject({ Event: "Club", White: "Alice", Black: "Bob", Result: "*" });
    expect(parsed.san).toEqual(["d4", "d5", "Nf3"]);

    const custom = parseAnalysisPgn('[Event "Setup"]\n[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. O-O *');
    const customVariation = parseAnalysisPgn(exportAnalysisVariation(custom.start, ["Rh2"], custom.headers));
    expect(customVariation.start).toBe(custom.start);
    expect(customVariation.headers.Event).toBe("Setup");
    expect(customVariation.san).toEqual(["Rh2"]);
    expect(new Chess().pgn()).toBe(exportAnalysisVariation(new Chess().fen(), []));
  });
});
