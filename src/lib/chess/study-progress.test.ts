import { describe, expect, it, vi } from "vitest";
import { mergeStudyCompletions, readStudyCompletions, recordStudyCompletion, sanitizeStudyCompletions } from "./study-progress";

describe("device-local study mastery", () => {
  it("accepts only known opening and lesson sides, deduplicated", () => {
    expect(sanitizeStudyCompletions(["italian:w", "develop:b", "italian:w", "bogus:w", "italian:x", null, 3])).toEqual(["italian:w", "develop:b"]);
    expect(sanitizeStudyCompletions({ "italian:w": true })).toEqual([]);
  });

  it("merges different catalogues without retaining forged entries", () => {
    expect(mergeStudyCompletions(["italian:w", "fake:w"], ["castle:b", "italian:b"], ["castle:b"])).toEqual(["italian:w", "castle:b", "italian:b"]);
  });

  it("preserves in-memory mastery when browser storage fails", () => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: vi.fn(() => { throw new Error("storage disabled"); }),
      setItem: vi.fn(() => { throw new Error("quota"); }),
    } });
    try {
      expect(readStudyCompletions()).toEqual([]);
      expect(recordStudyCompletion(["italian:w"], "develop:b")).toEqual(["italian:w", "develop:b"]);
    } finally {
      if (prior) Object.defineProperty(globalThis, "localStorage", prior);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
});
