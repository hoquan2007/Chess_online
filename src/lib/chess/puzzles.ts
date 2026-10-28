import { Chess } from "chess.js";

export const puzzles = [
  { id: "mate-001", title: "The queen finishes", description: "White to move. Checkmate in one.", fen: "6k1/6pp/5KQ1/8/8/8/8/8 w - - 0 1", solution: "Qxg7#", hint: "Look at the undefended pawn beside the king." },
  { id: "mate-002", title: "The back corner", description: "White to move. Checkmate in one.", fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1", solution: "Qc8#", hint: "Keep the king trapped on the last rank." },
  { id: "tactic-003", title: "Escape with tempo", description: "White is in check. Find the best capture.", fen: "4k3/8/8/8/8/8/4r3/4KQ2 w - - 0 1", solution: "Qxe2+", hint: "Your queen can capture the rook while checking the king." },
] as const;

export function isPuzzleSolution(id: string, from: string, to: string): boolean {
  const puzzle = puzzles.find((item) => item.id === id);
  if (!puzzle) return false;
  const game = new Chess(puzzle.fen);
  try { return game.move({ from, to, promotion: "q" }).san === puzzle.solution; }
  catch { return false; }
}
