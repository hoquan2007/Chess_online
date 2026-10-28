import { Chess } from "chess.js";
import { chooseBotMove, type Difficulty } from "@/lib/chess/bot";

self.onmessage = (event: MessageEvent<{ pgn: string; level: Difficulty; request: number }>) => {
  try {
    const game = new Chess();
    if (event.data.pgn.trim()) game.loadPgn(event.data.pgn);
    const move = chooseBotMove(game, event.data.level);
    self.postMessage({ request: event.data.request, move: move ? { from: move.from, to: move.to, promotion: move.promotion } : null });
  } catch (error) {
    self.postMessage({ request: event.data.request, error: error instanceof Error ? error.message : "Engine failed" });
  }
};
