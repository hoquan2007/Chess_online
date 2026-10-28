export type ClockSide = "w" | "b";
export type LocalClocks = Record<ClockSide, number>;

/** Charge actual elapsed time to the active side, even when browser timers are throttled. */
export function advanceLocalClock(clocks: LocalClocks, turn: ClockSide, elapsedMs: number): LocalClocks {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || clocks[turn] <= 0) return clocks;
  return { ...clocks, [turn]: Math.max(0, clocks[turn] - elapsedMs / 1000) };
}
