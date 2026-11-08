import { describe, expect, it } from "vitest";
import { firstCanonicalPlyRead } from "../e2e/staging-latency-read";

describe("live opponent GET timing attribution", () => {
  it("ignores an earlier successful polling response containing the old ply", () => {
    const stalePoll = { start: 10, response: 150, status: 200, responsePly: 7 };
    const newMove = { start: 160, response: 260, status: 200, responsePly: 8 };
    expect(firstCanonicalPlyRead([stalePoll, newMove], 8)).toBe(newMove);
  });

  it("selects the first matching response rather than first request when reads race", () => {
    const slowerEarlierRequest = { start: 10, response: 360, status: 200, responsePly: 9 };
    const fasterLaterRequest = { start: 70, response: 210, status: 200, responsePly: 9 };
    expect(firstCanonicalPlyRead([slowerEarlierRequest, fasterLaterRequest], 9)).toBe(fasterLaterRequest);
  });

  it("never attributes forbidden, failed, absent or unparsed responses as canonical", () => {
    const reads = [
      { start: 1, response: 40, status: 403, responsePly: 10 },
      { start: 2, response: 41, status: 503, responsePly: 10 },
      { start: 3, response: 42, status: 200, responsePly: 9 },
      { start: 4, status: 200, responsePly: 10 },
    ];
    expect(firstCanonicalPlyRead(reads, 10)).toBeUndefined();
  });
});
