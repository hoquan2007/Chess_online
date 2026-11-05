import { describe, expect, it } from "vitest";
import { formatStockfishScore, legalStockfishVariation, parseStockfishInfo } from "./stockfish";
import { Chess } from "chess.js";

describe("Stockfish UCI output", () => {
  it("normalizes engine score from the side to move and supports MultiPV", () => {
    const white = parseStockfishInfo("info depth 12 seldepth 22 multipv 2 score cp 41 nodes 523 pv e2e4 e7e5 g1f3", "w");
    expect(white).toMatchObject({ depth: 12, multipv: 2, score: { kind: "cp", value: 41 }, pv: ["e2e4", "e7e5", "g1f3"] });
    const black = parseStockfishInfo("info depth 8 multipv 1 score mate -3 pv e7e5 g1f3", "b");
    expect(black?.score).toEqual({ kind: "mate", value: 3 });
    expect(formatStockfishScore(black!.score)).toBe("White mate in 3");
  });

  it("rejects malformed, oversized, and non-search output", () => {
    expect(parseStockfishInfo("bestmove e2e4", "w")).toBeNull();
    expect(parseStockfishInfo("info depth 12 score cp 4 pv e2e9", "w")).toBeNull();
    expect(parseStockfishInfo("info depth 0 score cp 4 pv e2e4", "w")).toBeNull();
    expect(parseStockfishInfo("info depth 12 multipv 9 score cp 4 pv e2e4", "w")).toBeNull();
    expect(parseStockfishInfo("info depth 12 score cp 4 pv e2e4 " + "x".repeat(17000), "w")).toBeNull();
  });

  it("validates every suggested move against the exact board position", () => {
    const fen = new Chess().fen();
    const line = parseStockfishInfo("info depth 9 score cp 27 pv e2e4 e7e5 g1f3", "w")!;
    expect(legalStockfishVariation(fen, line)).toMatchObject({ first: { san: "e4", from: "e2", to: "e4" }, san: ["e4", "e5", "Nf3"] });
    expect(legalStockfishVariation(fen, { ...line, pv: ["e2e5"] })).toBeNull();
    expect(legalStockfishVariation(fen, { ...line, pv: ["e2e4", "e2e5"] })).toBeNull();
  });
});
