import { Chess, type Move, type Square } from "chess.js";

export type GameResult = { finished: boolean; label: string; winner: "w" | "b" | null };
export type MoveInput = { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" };
export type DrawClaim = "repetition" | "fiftyMoves";

/** Keyboard-friendly coordinate notation: e2e4, e2-e4 or e7e8q. */
export function parseCoordinateMove(value: string): MoveInput | null {
  const match = /^([a-h][1-8])\s*-?\s*([a-h][1-8])\s*([qrbn])?$/.exec(value.trim().toLowerCase());
  if (!match) return null;
  return { from: match[1] as Square, to: match[2] as Square,
    ...(match[3] ? { promotion: match[3] as "q" | "r" | "b" | "n" } : {}) };
}

/** FIDE 6.9: a flag fall is a draw if the other side cannot mate by any legal sequence. */
export function timeoutResult(game: Chess, flaggedSide: "w" | "b"): GameResult {
  const winner = flaggedSide === "w" ? "b" : "w";
  const pieces = game.board().flat().filter((piece) => piece !== null);
  const potentialWinner = pieces.filter((piece) => piece.color === winner && piece.type !== "k");
  const flaggedPieces = pieces.filter((piece) => piece.color === flaggedSide && piece.type !== "k");
  const noMatingPotential = potentialWinner.length === 0 ||
    (potentialWinner.length === 1 && flaggedPieces.length === 0 &&
      (potentialWinner[0].type === "b" || potentialWinner[0].type === "n"));
  return noMatingPotential
    ? { finished: true, label: "Draw: timeout without mating material", winner: null }
    : { finished: true, label: "Timeout", winner };
}

/** Under FIDE rules three repetitions / 50 moves permit a claim, not automatic termination. */
export function availableDrawClaims(game: Chess) {
  return {
    repetition: game.isThreefoldRepetition(),
    fiftyMoves: Number(game.fen().split(" ")[4]) >= 100,
  };
}

export function mayClaimDraw(game: Chess, side: "w" | "b", rule: DrawClaim): boolean {
  if (gameResult(game).finished || game.turn() !== side) return false;
  return availableDrawClaims(game)[rule];
}

function repetitionKey(fen: string) {
  const [board, side, castling, enPassant] = fen.split(" ");
  if (enPassant === "-") return `${board} ${side} ${castling} -`;
  // A target square does not distinguish FIDE positions unless an en-passant
  // capture is actually legal. chess.js includes target squares after double moves.
  const position = new Chess(fen);
  const canCapture = position.moves({ verbose: true }).some((move) => move.isEnPassant());
  return `${board} ${side} ${castling} ${canCapture ? enPassant : "-"}`;
}

function currentPositionOccurrences(game: Chess) {
  const moves = game.history({ verbose: true });
  if (!moves.length) return 1;
  const target = repetitionKey(game.fen());
  const states = [moves[0].before, ...moves.map((move) => move.after)];
  return states.filter((fen) => repetitionKey(fen) === target).length;
}

export function applyLegalMove(game: Chess, input: MoveInput): Move | null {
  try {
    return game.move(input);
  } catch {
    return null;
  }
}

export function gameResult(game: Chess): GameResult {
  if (game.isCheckmate()) {
    return { finished: true, label: "Checkmate", winner: game.turn() === "w" ? "b" : "w" };
  }
  if (game.isStalemate()) return { finished: true, label: "Stalemate", winner: null };
  if (game.isInsufficientMaterial()) return { finished: true, label: "Draw: insufficient material", winner: null };
  // Automatic draws occur at five repetitions / 75 moves. Checkmate above
  // takes precedence even if the final move also reaches the 75-move threshold.
  if (Number(game.fen().split(" ")[4]) >= 150) return { finished: true, label: "Draw: seventy-five-move rule", winner: null };
  if (game.isThreefoldRepetition() && currentPositionOccurrences(game) >= 5) {
    return { finished: true, label: "Draw: fivefold repetition", winner: null };
  }
  return { finished: false, label: game.isCheck() ? "Check" : "Game in progress", winner: null };
}

export function restoreLocalGame(pgn: string): Chess {
  const game = new Chess();
  if (pgn.trim()) game.loadPgn(pgn);
  return game;
}

export function pgnDownload(game: Chess): string {
  return `[Event "Rookline local game"]\n[Site "Rookline"]\n\n${game.pgn()}`;
}

export function selectPromotion(game: Chess, from: Square, to: Square) {
  return game.moves({ square: from, verbose: true }).some((move) => move.to === to && !!move.promotion);
}
