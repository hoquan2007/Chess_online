import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { positionInsight } from "./insights";

describe("analysis position insight", () => {
  it("reports turn, material points, and legal moves without changing the game", () => {
    const game = new Chess();
    const original = game.fen();
    expect(positionInsight(game)).toMatchObject({ turn: "White", status: "Game in progress", material: "Even", legalMoves: 20 });
    expect(game.fen()).toBe(original);
    for (const san of ["e4", "d5", "exd5"]) game.move(san);
    expect(positionInsight(game)).toMatchObject({ turn: "Black", material: "White +1" });
  });

  it("distinguishes checkmate, stalemate, and claimable (nonterminal) draws", () => {
    const mate = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) mate.move(san);
    expect(positionInsight(mate)).toMatchObject({ turn: "White", status: "Checkmate — Black wins", legalMoves: 0 });
    expect(positionInsight(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toMatchObject({
      status: "Stalemate", legalMoves: 0,
    });
    const repeating = new Chess();
    for (let index = 0; index < 2; index++) for (const san of ["Nf3", "Nf6", "Ng1", "Ng8"]) repeating.move(san);
    expect(positionInsight(repeating)).toMatchObject({
      status: "Game in progress", drawClaim: "threefold repetition",
    });
  });
});
