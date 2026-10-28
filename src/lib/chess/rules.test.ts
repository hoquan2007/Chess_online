import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { applyLegalMove, availableDrawClaims, gameResult, localPgnResult, mayClaimDraw, parseCoordinateMove, pgnDownload, resignationResult, restoreLocalGame, selectPromotion, timeoutResult } from "./rules";
import { chooseBotMove } from "./bot";

describe("chess rules", () => {
  it("parses keyboard moves including explicit promotions and rejects malformed input", () => {
    expect(parseCoordinateMove(" E2 - E4 ")).toEqual({ from: "e2", to: "e4" });
    expect(parseCoordinateMove("a7a8n")).toEqual({ from: "a7", to: "a8", promotion: "n" });
    expect(parseCoordinateMove("e9e4")).toBeNull();
    expect(parseCoordinateMove("e2e4x")).toBeNull();
  });
  it("rejects illegal and out of turn moves", () => {
    const game = new Chess();
    expect(applyLegalMove(game, { from: "e2", to: "e5" })).toBeNull();
    expect(applyLegalMove(game, { from: "e7", to: "e5" })).toBeNull();
    expect(game.fen()).toBe(new Chess().fen());
  });

  it("detects checkmate", () => {
    const game = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) game.move(san);
    expect(gameResult(game)).toEqual({ finished: true, label: "Checkmate", winner: "b" });
  });

  it("exports parseable PGN with a FIDE result without modifying the live board", () => {
    const game = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4#"]) game.move(move);
    const before = game.pgn();
    const result = localPgnResult(null, gameResult(game), null);
    expect(result).toBe("0-1");
    const restored = new Chess();
    restored.loadPgn(pgnDownload(game, result));
    expect(restored.fen()).toBe(game.fen());
    expect(restored.getHeaders().Result).toBe("0-1");
    expect(restored.getHeaders().Event).toBe("Rookline local game");
    expect(game.pgn()).toBe(before);
  });

  it("preserves a nonstandard starting FEN when exporting a PGN", () => {
    const game = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    game.move({ from: "a7", to: "a8", promotion: "n" });
    const restored = restoreLocalGame(pgnDownload(game));
    expect(restored.fen()).toBe(game.fen());
    expect(restored.history()).toEqual(["a8=N"]);
    expect(restored.getHeaders().SetUp).toBe("1");
  });

  it("exports resignation, timeout draw, and ongoing results consistently", () => {
    const game = new Chess();
    expect(localPgnResult(null, gameResult(game), null)).toBe("*");
    expect(localPgnResult("White resigned", gameResult(game), null)).toBe("0-1");
    expect(localPgnResult("Black resigned", gameResult(game), null)).toBe("1-0");
    expect(localPgnResult("Draw: claimed threefold repetition", gameResult(game), null)).toBe("1/2-1/2");
    const drawnTimeout = timeoutResult(new Chess("4k3/8/8/8/8/8/8/4K2Q w - - 0 1"), "w");
    expect(localPgnResult(null, gameResult(game), drawnTimeout)).toBe("1/2-1/2");
    const parsed = new Chess();
    parsed.loadPgn(pgnDownload(game));
    expect(parsed.getHeaders().Result).toBe("*");
  });

  it("supports legal castling and en passant", () => {
    const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(applyLegalMove(castle, { from: "e1", to: "g1" })?.san).toBe("O-O");
    const pawn = new Chess();
    for (const san of ["e4", "a6", "e5", "d5"]) pawn.move(san);
    expect(applyLegalMove(pawn, { from: "e5", to: "d6" })?.flags).toContain("e");
  });

  it("promotes and restores PGN including move history", () => {
    const game = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    expect(selectPromotion(game, "a7", "a8")).toBe(true);
    expect(applyLegalMove(game, { from: "a7", to: "a8", promotion: "q" })?.promotion).toBe("q");
    const played = new Chess();
    played.move("e4");
    played.move("e5");
    expect(restoreLocalGame(played.pgn()).history()).toEqual(["e4", "e5"]);
  });

  it("identifies stalemate and insufficient material", () => {
    expect(gameResult(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).label).toBe("Stalemate");
    expect(gameResult(new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).label).toContain("insufficient");
  });

  it("allows a threefold draw claim but only auto-ends at fivefold", () => {
    const game = new Chess();
    const cycle = ["Nf3", "Nf6", "Ng1", "Ng8"];
    for (let i = 0; i < 2; i++) for (const san of cycle) game.move(san);
    expect(availableDrawClaims(game).repetition).toBe(true);
    expect(mayClaimDraw(game, "w", "repetition")).toBe(true);
    expect(mayClaimDraw(game, "b", "repetition")).toBe(false);
    expect(gameResult(game).finished).toBe(false);
    for (let i = 0; i < 2; i++) for (const san of cycle) game.move(san);
    expect(gameResult(game)).toEqual({ finished: true, label: "Draw: fivefold repetition", winner: null });
  });

  it("makes the fifty-move rule claimable but automatically ends at 75 moves", () => {
    const claimable = new Chess("8/8/8/8/8/8/R7/K6k w - - 100 51");
    expect(availableDrawClaims(claimable).fiftyMoves).toBe(true);
    expect(mayClaimDraw(claimable, "w", "fiftyMoves")).toBe(true);
    expect(mayClaimDraw(claimable, "w", "repetition")).toBe(false);
    expect(gameResult(claimable).finished).toBe(false);
    const automatic = new Chess("8/8/8/8/8/8/R7/K6k w - - 150 76");
    expect(gameResult(automatic)).toEqual({ finished: true, label: "Draw: seventy-five-move rule", winner: null });
  });

  it("keeps checkmate decisive even at the 75-move boundary", () => {
    const mate = new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 150 76");
    expect(gameResult(mate)).toEqual({ finished: true, label: "Checkmate", winner: "w" });
  });

  it("adjudicates a flag fall by possible mating material, not the flag alone", () => {
    const queenVsKing = new Chess("4k3/8/8/8/8/8/8/4K2Q w - - 0 1");
    expect(timeoutResult(queenVsKing, "w")).toEqual({ finished: true, label: "Draw: timeout without mating material", winner: null });
    expect(timeoutResult(queenVsKing, "b").winner).toBe("w");
    const bishopVsKing = new Chess("4k3/8/8/8/8/8/8/4KB2 w - - 0 1");
    expect(timeoutResult(bishopVsKing, "b").winner).toBeNull();
    const bishopWithEnemyPawn = new Chess("4k3/p7/8/8/8/8/8/4KB2 w - - 0 1");
    expect(timeoutResult(bishopWithEnemyPawn, "b").winner).toBe("w");
    const twoKnights = new Chess("4k3/8/8/8/8/8/8/4KNN1 w - - 0 1");
    expect(timeoutResult(twoKnights, "b").winner).toBe("w");
  });

  it("draws flagged games with only same-colored bishops, including promotion extras", () => {
    const promotedSameColor = new Chess("4k3/8/8/8/8/4B3/8/2B1K3 w - - 0 1");
    expect(timeoutResult(promotedSameColor, "b").winner).toBeNull();
    const oppositeColor = new Chess("4k3/8/8/8/8/3B4/8/2B1K3 w - - 0 1");
    expect(timeoutResult(oppositeColor, "b").winner).toBe("w");
    const bothBishopsSameColor = new Chess("4k3/6b1/8/8/8/4B3/8/4K3 w - - 0 1");
    expect(timeoutResult(bothBishopsSameColor, "b").winner).toBeNull();
    const bothBishopsOppositeColor = new Chess("4k3/5b2/8/8/8/4B3/8/4K3 w - - 0 1");
    expect(timeoutResult(bothBishopsOppositeColor, "b").winner).toBe("w");
  });

  it("applies FIDE resignation draw exception and exports a drawn result", () => {
    const queenVsKing = new Chess("4k3/8/8/8/8/8/8/4K2Q w - - 0 1");
    const whiteResigns = resignationResult(queenVsKing, "w");
    expect(whiteResigns).toEqual({ finished: true, label: "Draw: resignation without mating material", winner: null });
    expect(localPgnResult(whiteResigns.label, gameResult(queenVsKing), null)).toBe("1/2-1/2");
    expect(resignationResult(queenVsKing, "b").winner).toBe("w");
    const bishopAndEnemyPawn = new Chess("4k3/p7/8/8/8/8/8/4KB2 w - - 0 1");
    expect(resignationResult(bishopAndEnemyPawn, "b").winner).toBe("w");
    expect(resignationResult(new Chess("4k3/8/8/8/8/4B3/8/2B1K3 w - - 0 1"), "b").winner).toBeNull();
  });

  it("computer returns a legal move without mutating the input", () => {
    const game = new Chess();
    const initial = game.fen();
    for (const difficulty of ["easy", "medium", "hard", "advanced"] as const) {
      const chosen = chooseBotMove(game, difficulty);
      expect(chosen).not.toBeNull();
      expect(game.moves()).toContain(chosen!.san);
    }
    expect(game.fen()).toBe(initial);
  });
});
