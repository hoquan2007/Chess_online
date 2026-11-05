import { describe, expect, it } from "vitest";
import { knownLearningIds, parseLearningWrite } from "./learning-progress";

describe("verified learning completion identifiers", () => {
  it("accepts only original catalogue IDs", () => {
    expect(parseLearningWrite({ kind: "puzzle", ids: ["mate-001"] })).toEqual({ ok: true, kind: "puzzle", ids: ["mate-001"] });
    expect(knownLearningIds("study", ["fake", "intro:w", "fake"])).not.toContain("fake");
  });
  it("rejects forged, duplicated and oversized payloads", () => {
    for (const value of [null, [], { kind: "unknown", ids: ["mate-001"] },
      { kind: "puzzle", ids: ["mate-001", "mate-001"] }, { kind: "puzzle", ids: ["fake"] },
      { kind: "puzzle", ids: Array(65).fill("mate-001") },
      { kind: "puzzle", ids: ["mate-001"], user_id: "forged" }]) {
      expect(parseLearningWrite(value)).toEqual({ ok: false });
    }
  });
});
