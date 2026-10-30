import { Chess, type Move } from "chess.js";
import { gameResult } from "./rules";

export type Difficulty = "easy" | "medium" | "hard" | "advanced";

const material: Record<string, number> = { p: 100, n: 315, b: 330, r: 500, q: 900, k: 0 };

/** Small, symmetric positional bonus in centipawns; material remains dominant. */
function positionalValue(type: string, color: "w" | "b", row: number, file: number): number {
  const centerFile = 3.5 - Math.abs(file - 3.5);
  const centerRank = 3.5 - Math.abs(row - 3.5);
  const pawnAdvance = color === "w" ? 6 - row : row - 1;
  switch (type) {
    case "p": return centerFile * 9 + pawnAdvance * 11;
    case "n": return (centerFile + centerRank) * 9;
    case "b": return (centerFile + centerRank) * 4;
    case "r": return centerFile * 2;
    case "q": return (centerFile + centerRank) * 2;
    default: return 0;
  }
}

function evaluate(game: Chess, perspective: "w" | "b", ply: number): number {
  // Prefer a shorter forced mate, and delay a forced loss when possible.
  if (game.isCheckmate()) return game.turn() === perspective ? -100000 + ply : 100000 - ply;
  if (gameResult(game).finished) return 0;
  let score = 0;
  for (const [rowIndex, row] of game.board().entries()) {
    for (const [file, piece] of row.entries()) {
      if (!piece) continue;
      const points = (material[piece.type] ?? 0) + positionalValue(piece.type, piece.color, rowIndex, file);
      score += points * (piece.color === perspective ? 1 : -1);
    }
  }
  return score;
}

function search(game: Chess, depth: number, alpha: number, beta: number, perspective: "w" | "b", ply: number): number {
  if (depth === 0 || gameResult(game).finished) return evaluate(game, perspective, ply);
  const maximizing = game.turn() === perspective;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    const score = search(game, depth - 1, alpha, beta, perspective, ply + 1);
    game.undo();
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseBotMove(game: Chess, difficulty: Difficulty): Move | null {
  if (gameResult(game).finished) return null;
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return null;
  if (difficulty === "easy") return legal[Math.floor(Math.random() * legal.length)];
  const depth = difficulty === "medium" ? 0 : difficulty === "hard" ? 1 : 2;
  const perspective = game.turn();
  let best = -Infinity;
  let selected = legal[0];
  for (const move of legal) {
    game.move(move);
    const score = search(game, depth, -Infinity, Infinity, perspective, 1);
    game.undo();
    if (score > best) {
      best = score;
      selected = move;
    }
  }
  return selected;
}

/** A deliberately small, original material/position search hint, not a full chess engine. */
export function analyzeBotPosition(game: Chess): {
  finished: boolean;
  bestMove: { san: string; from: string; to: string; promotion?: string } | null;
  scoreCp: number | null;
  depth: number;
} {
  const depth = 2;
  if (gameResult(game).finished) return { finished: true, bestMove: null, scoreCp: null, depth };
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return { finished: true, bestMove: null, scoreCp: null, depth };
  const perspective = game.turn();
  let bestScore = -Infinity;
  let bestMove = legal[0];
  for (const move of legal) {
    game.move(move);
    const score = search(game, depth - 1, -Infinity, Infinity, perspective, 1);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return {
    finished: false,
    bestMove: { san: bestMove.san, from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion },
    scoreCp: perspective === "w" ? bestScore : -bestScore,
    depth,
  };
}
