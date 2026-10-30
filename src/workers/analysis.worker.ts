import { Chess } from "chess.js";
import { analyzeBotPosition } from "@/lib/chess/bot";

self.onmessage = (event: MessageEvent<{ request: number; key: string; fen: string; start: string; san: string[] }>) => {
  const { request, key, fen, start, san } = event.data;
  try {
    const game = new Chess(start);
    for (const move of san) game.move(move);
    if (game.fen() !== fen) throw new Error("Position history mismatch");
    const result = analyzeBotPosition(game);
    self.postMessage({ request, key, result });
  } catch {
    self.postMessage({ request, key, error: "Unable to analyze this position." });
  }
};
