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
      headers: game.getHeaders(),
    };
  } catch {
    throw new Error("Invalid PGN. Check the move text and try again.");
  }
}

/** Export a changed analysis line while retaining its PGN event/player metadata. */
export function exportAnalysisVariation(start: string, san: string[], sourceHeaders: Record<string, string> = {}) {
  const game = new Chess(start);
  for (const [key, value] of Object.entries(sourceHeaders)) {
    // Chess.js derives setup tags from the actual starting position.
    if (key !== "Result" && key !== "FEN" && key !== "SetUp") game.header(key, value);
  }
  // An imported outcome cannot describe a line the player has branched away from.
  if (Object.keys(sourceHeaders).length > 0) game.header("Result", "*");
  for (const move of san) game.move(move);
  return game.pgn();
}
