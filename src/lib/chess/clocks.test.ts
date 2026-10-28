import { describe, expect, it } from "vitest";
import { advanceLocalClock } from "./clocks";

describe("local chess clock settlement", () => {
  it("charges the side to move after long timer throttling, leaving the other clock untouched", () => {
    const before = { w: 180, b: 180 };
    expect(advanceLocalClock(before, "b", 181_000)).toEqual({ w: 180, b: 0 });
    expect(before).toEqual({ w: 180, b: 180 });
  });

  it("preserves subsecond precision and never creates a negative clock", () => {
    const after = advanceLocalClock({ w: 12, b: 10 }, "w", 1250);
    expect(after).toEqual({ w: 10.75, b: 10 });
    expect(advanceLocalClock(after, "w", 500_000).w).toBe(0);
  });

  it("ignores invalid or nonpositive elapsed time", () => {
    const clocks = { w: 15, b: 20 };
    expect(advanceLocalClock(clocks, "w", NaN)).toBe(clocks);
    expect(advanceLocalClock(clocks, "b", -500)).toBe(clocks);
  });
});
