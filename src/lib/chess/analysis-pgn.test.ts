import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { analysisMoveRows, parseAnalysisPgn, maxAnalysisPgnBytes, exportAnalysisVariation } from "./analysis-pgn";

describe("analysis PGN file input", () => {
  it("numbers and groups SAN using the actual starting side and fullmove", () => {
    const standard = new Chess().fen();
    expect(analysisMoveRows(standard, ["e4", "e5", "Nf3"])).toEqual([
      { number: 1, white: { san: "e4", ply: 1 }, black: { san: "e5", ply: 2 } },
      { number: 2, white: { san: "Nf3", ply: 3 } },
    ]);
    const blackStart = "4k3/8/8/8/8/8/8/4K3 b - - 0 8";
    expect(analysisMoveRows(blackStart, ["Kd7", "Ke2", "Ke6", "Ke3"])).toEqual([
      { number: 8, black: { san: "Kd7", ply: 1 } },
      { number: 9, white: { san: "Ke2", ply: 2 }, black: { san: "Ke6", ply: 3 } },
      { number: 10, white: { san: "Ke3", ply: 4 } },
    ]);
    expect(analysisMoveRows(blackStart, [])).toEqual([]);
    expect(analysisMoveRows("4k3/8/8/8/8/8/8/4K3 w - - 0 42", ["Ke2"])).toEqual([
      { number: 42, white: { san: "Ke2", ply: 1 } },
    ]);
  });
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
