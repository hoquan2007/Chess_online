/** A background poll can finish during a move without containing that move. */
export type TimedGameRead = {
  start: number;
  response?: number;
  status?: number;
  responsePly?: number;
};

/** Identify the earliest successful response that actually contains this ply. */
export function firstCanonicalPlyRead<T extends TimedGameRead>(reads: readonly T[], ply: number): T | undefined {
  return reads.reduce<T | undefined>((earliest, read) => {
    if (read.status !== 200 || read.responsePly !== ply || read.response === undefined) return earliest;
    return !earliest || read.response < earliest.response! ? read : earliest;
  }, undefined);
}
