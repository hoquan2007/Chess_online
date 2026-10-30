import { Chess } from "chess.js";
import { availableDrawClaims, gameResult } from "./rules";

const piecePoints: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Descriptive, non-engine study data. Material points are not an evaluation. */
export function positionInsight(game: Chess) {
  const result = gameResult(game);
  const points = { w: 0, b: 0 };
  for (const row of game.board()) {
    for (const piece of row) if (piece) points[piece.color] += piecePoints[piece.type] ?? 0;
  }
  const lead = points.w - points.b;
  const claims = result.finished ? null : availableDrawClaims(game);
  return {
    turn: game.turn() === "w" ? "White" : "Black",
    status: result.label === "Checkmate"
      ? `Checkmate — ${result.winner === "w" ? "White" : "Black"} wins`
      : result.label,
    material: lead === 0 ? "Even" : `${lead > 0 ? "White" : "Black"} +${Math.abs(lead)}`,
    legalMoves: game.moves().length,
    drawClaim: [claims?.repetition ? "threefold repetition" : null, claims?.fiftyMoves ? "50-move rule" : null]
      .filter(Boolean).join(" and "),
  };
}
