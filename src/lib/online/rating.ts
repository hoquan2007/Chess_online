import { timeControls } from "./games";

export type RatingCategory = "bullet" | "blitz" | "rapid";
export type PlayerRating = Readonly<{ rating: number; gamesPlayed: number }>;
export type RatingUpdate = Readonly<{ oldRating: number; newRating: number; delta: number; gamesPlayed: number }>;

/** Only time controls actually offered by Rookline can enter a rated pool. */
export function ratingCategoryForControl(baseMs: number, incrementMs: number): RatingCategory {
  if (baseMs === timeControls["3+2"].base_ms && incrementMs === timeControls["3+2"].increment_ms) return "blitz";
  if (baseMs === timeControls["5+0"].base_ms && incrementMs === timeControls["5+0"].increment_ms) return "blitz";
  if (baseMs === timeControls["10+0"].base_ms && incrementMs === timeControls["10+0"].increment_ms) return "rapid";
  throw new Error("Unsupported rated time control");
}

function validateRating(player: PlayerRating) {
  if (!Number.isInteger(player.rating) || player.rating < 100 || player.rating > 4000 ||
      !Number.isInteger(player.gamesPlayed) || player.gamesPlayed < 0 ||
      player.gamesPlayed >= 2147483647) {
    throw new Error("Invalid persisted rating");
  }
}

/** Rookline's deterministic Elo-style calculation. The database must apply
 * both updates and write the unique (game, player) ledger atomically. */
export function calculateRatingUpdates(
  white: PlayerRating,
  black: PlayerRating,
  winner: "w" | "b" | null,
): { white: RatingUpdate; black: RatingUpdate } {
  validateRating(white);
  validateRating(black);
  if (winner !== "w" && winner !== "b" && winner !== null) throw new Error("Invalid game result");

  const expectedWhite = 1 / (1 + 10 ** ((black.rating - white.rating) / 400));
  const whiteScore = winner === null ? 0.5 : winner === "w" ? 1 : 0;
  const update = (player: PlayerRating, expected: number, score: number): RatingUpdate => {
    // Provisional players adjust faster; all players use the same bounded scale.
    const k = player.gamesPlayed < 20 ? 40 : 24;
    const newRating = Math.max(100, Math.min(4000, player.rating + Math.round(k * (score - expected))));
    return { oldRating: player.rating, newRating, delta: newRating - player.rating,
      gamesPlayed: player.gamesPlayed + 1 };
  };
  return {
    white: update(white, expectedWhite, whiteScore),
    black: update(black, 1 - expectedWhite, 1 - whiteScore),
  };
}
