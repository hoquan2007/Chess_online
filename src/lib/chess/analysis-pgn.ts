import { Chess } from "chess.js";

export const maxAnalysisPgnBytes = 32 * 1024;

/** Keep arbitrary pasted/uploaded PGN bounded before chess.js parses its moves. */
export function parseAnalysisPgn(raw: string) {
  if (new TextEncoder().encode(raw).length > maxAnalysisPgnBytes) {
    throw new Error("PGN is larger than 32 KB. Choose a shorter game.");
  }
  if (!raw.trim()) throw new Error("PGN is empty.");
  try {
    const game = new Chess();
    game.loadPgn(raw.replace(/^\uFEFF/, ""));
    return {
      start: game.header().FEN || new Chess().fen(),
      san: game.history(),
      pgn: game.pgn(),
    };
  } catch {
    throw new Error("Invalid PGN. Check the move text and try again.");
  }
}
