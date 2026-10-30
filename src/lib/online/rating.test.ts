import { describe, expect, it } from "vitest";
import { calculateRatingUpdates, ratingCategoryForControl } from "./rating";

describe("future rated game settlement mathematics", () => {
  it("maps only supported time controls into their chess rating pools", () => {
    expect(ratingCategoryForControl(180000, 2000)).toBe("blitz");
    expect(ratingCategoryForControl(300000, 0)).toBe("blitz");
    expect(ratingCategoryForControl(600000, 0)).toBe("rapid");
    expect(() => ratingCategoryForControl(0, 0)).toThrow("Unsupported");
    expect(() => ratingCategoryForControl(180000, 0)).toThrow("Unsupported");
  });

  it("scores a provisional game and increments both players once", () => {
    const white = { rating: 1200, gamesPlayed: 0 };
    const black = { rating: 1200, gamesPlayed: 0 };
    expect(calculateRatingUpdates(white, black, "w")).toEqual({
      white: { oldRating: 1200, newRating: 1220, delta: 20, gamesPlayed: 1 },
      black: { oldRating: 1200, newRating: 1180, delta: -20, gamesPlayed: 1 },
    });
    expect(white).toEqual({ rating: 1200, gamesPlayed: 0 });
  });

  it("rewards an underdog's draw, and uses a smaller factor for established players", () => {
    const outcome = calculateRatingUpdates(
      { rating: 1000, gamesPlayed: 20 }, { rating: 1400, gamesPlayed: 20 }, null,
    );
    expect(outcome.white.delta).toBe(10);
    expect(outcome.black.delta).toBe(-10);
    expect(outcome.white.gamesPlayed).toBe(21);
    expect(outcome.black.gamesPlayed).toBe(21);
  });

  it("is symmetrical when colors and winner are swapped", () => {
    const stronger = { rating: 1700, gamesPlayed: 41 };
    const newer = { rating: 1300, gamesPlayed: 2 };
    const first = calculateRatingUpdates(stronger, newer, "b");
    const swapped = calculateRatingUpdates(newer, stronger, "w");
    expect(first.white).toEqual(swapped.black);
    expect(first.black).toEqual(swapped.white);
  });

  it("never crosses persisted rating bounds", () => {
    const outcome = calculateRatingUpdates(
      { rating: 4000, gamesPlayed: 100 }, { rating: 100, gamesPlayed: 0 }, "w",
    );
    expect(outcome.white.newRating).toBe(4000);
    expect(outcome.black.newRating).toBe(100);
  });

  it("rejects malformed database values and outcomes before computing", () => {
    const player = { rating: 1200, gamesPlayed: 0 };
    expect(() => calculateRatingUpdates({ rating: Infinity, gamesPlayed: 0 }, player, "w")).toThrow();
    expect(() => calculateRatingUpdates({ rating: 1200.5, gamesPlayed: 0 }, player, "w")).toThrow();
    expect(() => calculateRatingUpdates(player, { rating: 99, gamesPlayed: 0 }, "w")).toThrow();
    expect(() => calculateRatingUpdates(player, { rating: 1200, gamesPlayed: -1 }, "w")).toThrow();
    expect(() => calculateRatingUpdates(player, { rating: 1200, gamesPlayed: 2147483647 }, "w")).toThrow();
    expect(() => calculateRatingUpdates(player, player, "forged" as "w")).toThrow();
  });
});
