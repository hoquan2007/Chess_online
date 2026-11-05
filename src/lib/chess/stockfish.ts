import { Chess, type Square } from "chess.js";

export type StockfishScore = { kind: "cp" | "mate"; value: number };
export type StockfishLine = {
  multipv: number;
  depth: number;
  score: StockfishScore;
  pv: string[];
};

const uciMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** UCI info scores are relative to the player to move. Normalize to White. */
export function parseStockfishInfo(line: string, turn: "w" | "b"): StockfishLine | null {
  if (!line.startsWith("info ") || line.length > 16_384) return null;
  const depth = /\bdepth (\d+)\b/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
  const pv = /\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?:\s+|$))+)/.exec(line);
  if (!depth || !score || !pv) return null;
  const parsedDepth = Number(depth[1]);
  const parsedScore = Number(score[2]);
  const variation = pv[1].trim().split(/\s+/).slice(0, 16);
  const multi = /\bmultipv (\d+)\b/.exec(line);
  const multipv = multi ? Number(multi[1]) : 1;
  if (!Number.isSafeInteger(parsedDepth) || parsedDepth < 1 || parsedDepth > 256 ||
      !Number.isSafeInteger(parsedScore) || Math.abs(parsedScore) > 100_000 ||
      !Number.isSafeInteger(multipv) || multipv < 1 || multipv > 3 ||
      !variation.length || variation.some((move) => !uciMove.test(move))) return null;
  return {
    multipv, depth: parsedDepth,
    score: { kind: score[1] as "cp" | "mate", value: parsedScore * (turn === "w" ? 1 : -1) },
    pv: variation,
  };
}

export function legalStockfishVariation(fen: string, line: StockfishLine): {
  first: { san: string; from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" };
  san: string[];
  score: StockfishScore;
  depth: number;
  multipv: number;
} | null {
  try {
    const board = new Chess(fen);
    const san: string[] = [];
    let first: { san: string; from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" } | null = null;
    for (const uci of line.pv) {
      if (!uciMove.test(uci)) return null;
      const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (!move) return null;
      if (!first) first = { san: move.san, from: move.from, to: move.to,
        promotion: move.promotion === "q" || move.promotion === "r" || move.promotion === "b" || move.promotion === "n" ? move.promotion : undefined };
      san.push(move.san);
    }
    return first ? { first, san, score: line.score, depth: line.depth, multipv: line.multipv } : null;
  } catch { return null; }
}

export function formatStockfishScore(score: StockfishScore) {
  if (score.kind === "mate") return `${score.value >= 0 ? "White" : "Black"} mate in ${Math.abs(score.value)}`;
  return score.value === 0 ? "Even (0.00)" : `${score.value > 0 ? "White" : "Black"} +${(Math.abs(score.value) / 100).toFixed(2)}`;
}
