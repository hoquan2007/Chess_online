import { describe, expect, it } from "vitest";
import { exportStudyProgress, maxStudyBackupBytes, parseStudyProgress } from "./study-backup";
import { mergeStudyCompletions } from "./study-progress";

describe("portable study mastery", () => {
  it("round trips both sides from openings and lessons while dropping unknown IDs", () => {
    expect(parseStudyProgress(exportStudyProgress(["italian:w", "develop:b", "italian:w", "spoofed:w"])))
      .toEqual(["italian:w", "develop:b"]);
    expect(parseStudyProgress("\uFEFF" + exportStudyProgress([]))).toEqual([]);
  });

  it("merges imported and current completions without losing either device's work", () => {
    expect(mergeStudyCompletions(["italian:w"], parseStudyProgress(exportStudyProgress(["castle:b", "italian:b"]))))
      .toEqual(["italian:w", "castle:b", "italian:b"]);
  });

  it("rejects malformed, unrelated, oversized, and unsupported-version files", () => {
    for (const raw of ["bad json", "[]", "{}", JSON.stringify({ kind: "rookline-puzzles", version: 1, completed: [] }),
      JSON.stringify({ kind: "rookline-study", version: 2, completed: [] }),
      JSON.stringify({ kind: "rookline-study", version: 1, completed: {} }),
      " ".repeat(maxStudyBackupBytes + 1)]) {
      expect(() => parseStudyProgress(raw)).toThrow();
    }
  });

  it("filters forged and non-string entries in otherwise valid files", () => {
    expect(parseStudyProgress(JSON.stringify({ kind: "rookline-study", version: 1,
      completed: ["italian:b", "unknown:w", "italian:b", 12, null] })))
      .toEqual(["italian:b"]);
  });
});
