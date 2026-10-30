import { describe, expect, it } from "vitest";
import { decodeHistoryCursor, encodeHistoryCursor, historyMembershipFilter } from "./history";

const user = "10000000-0000-4000-8000-000000000001";
const game = "20000000-0000-4000-8000-000000000002";
const timestamp = "2026-10-30T14:21:07.123456+00:00";

describe("authenticated online history pagination", () => {
  it("roundtrips exact PostgreSQL microseconds, preserving a deterministic tie-breaker", () => {
    const token = encodeHistoryCursor({ id: game, created_at: timestamp });
    expect(decodeHistoryCursor(token)).toEqual({ id: game, created_at: timestamp });
    expect(historyMembershipFilter(user, decodeHistoryCursor(token))).toBe([
      `and(white_id.eq.${user},created_at.lt.${timestamp})`,
      `and(white_id.eq.${user},created_at.eq.${timestamp},id.lt.${game})`,
      `and(black_id.eq.${user},created_at.lt.${timestamp})`,
      `and(black_id.eq.${user},created_at.eq.${timestamp},id.lt.${game})`,
    ].join(","));
  });

  it("filters both participant seats without a cursor", () => {
    expect(decodeHistoryCursor(null)).toBeNull();
    expect(historyMembershipFilter(user, null)).toBe(`white_id.eq.${user},black_id.eq.${user}`);
  });

  it("rejects malicious or malformed client cursors before building a privileged database filter", () => {
    for (const value of ["", "@invalid", "x".repeat(300),
      Buffer.from(JSON.stringify({ id: game, created_at: "2026-10-30T14:21:07.123Z),id.eq.bad" })).toString("base64url"),
      Buffer.from(JSON.stringify({ id: `wrong-id`, created_at: timestamp })).toString("base64url"),
      Buffer.from("[]").toString("base64url"),
      Buffer.from("not json").toString("base64url")]) {
      expect(() => decodeHistoryCursor(value)).toThrow("Invalid history cursor");
    }
    expect(() => historyMembershipFilter("invalid,black_id.eq.someone-else", null)).toThrow();
  });
});
