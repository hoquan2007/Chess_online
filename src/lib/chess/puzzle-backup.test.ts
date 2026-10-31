import { describe, expect, it } from "vitest";
import { exportPuzzleProgress, maxPuzzleBackupBytes, mergePuzzleProgress, parsePuzzleProgress } from "./puzzle-backup";

describe("portable puzzle progress", () => {
  it("round trips completions and adaptive scores without unknown entries", () => {
    const exported = exportPuzzleProgress({
      completed: ["fork-005", "mate-001", "fork-005", "unknown"],
      practice: { "fork-005": { errors: 3, hints: 1, solves: 2 }, unknown: { errors: 2, hints: 2, solves: 2 } },
    });
    expect(parsePuzzleProgress(exported)).toEqual({
      completed: ["fork-005", "mate-001"],
      practice: { "fork-005": { errors: 3, hints: 1, solves: 2 } },
    });
  });

  it("merges device progress without erasing completions or double-counting attempts", () => {
    const merged = mergePuzzleProgress(
      { completed: ["mate-001"], practice: { "mate-001": { errors: 2, hints: 0, solves: 1 } } },
      { completed: ["fork-005", "mate-001"], practice: {
        "mate-001": { errors: 1, hints: 3, solves: 5 }, "fork-005": { errors: 4, hints: 0, solves: 1 },
      } },
    );
    expect(merged).toEqual({
      completed: ["mate-001", "fork-005"],
      practice: {
        "mate-001": { errors: 2, hints: 3, solves: 5 },
        "fork-005": { errors: 4, hints: 0, solves: 1 },
      },
    });
  });

  it("rejects malformed, unrelated, oversized and future-version backups", () => {
    for (const raw of ["oops", "[]", "{}", JSON.stringify({ kind: "other", version: 1, completed: [], practice: {} }),
      JSON.stringify({ kind: "rookline-puzzles", version: 2, completed: [], practice: {} }),
      " ".repeat(maxPuzzleBackupBytes + 1)]) {
      expect(() => parsePuzzleProgress(raw)).toThrow();
    }
    expect(parsePuzzleProgress("\uFEFF" + exportPuzzleProgress({ completed: [], practice: {} })))
      .toEqual({ completed: [], practice: {} });
  });

  it("sanitizes tampered counters instead of trusting a backup", () => {
    const parsed = parsePuzzleProgress(JSON.stringify({ kind: "rookline-puzzles", version: 1,
      completed: ["fork-005", "spoofed"], practice: { "fork-005": { errors: 100000, hints: -5, solves: 2 },
        "__proto__": { errors: 99 } } }));
    expect(parsed).toEqual({ completed: ["fork-005"], practice: { "fork-005": { errors: 0, hints: 0, solves: 2 } } });
  });
});
