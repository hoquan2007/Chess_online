import { describe, expect, it } from "vitest";
import { parseProfileEdit } from "./edit";

describe("profile edit input", () => {
  it("normalizes a valid account update", () => {
    expect(parseProfileEdit({ username: "  Rook_Player  ", display_name: "  Player One  " }))
      .toEqual({ ok: true, value: { username: "rook_player", display_name: "Player One" } });
  });

  it.each([
    null, [], {}, { username: "ab", display_name: "Player" },
    { username: "bad.name", display_name: "Player" },
    { username: "rookline", display_name: "" },
    { username: "rookline", display_name: "a\nmalicious" },
    { username: "rookline", display_name: "A\u202eB" },
    { username: "rookline", display_name: "A\u200fB" },
    { username: "rookline", display_name: "x".repeat(81) },
    { username: "rookline", display_name: "Player", id: "another-user" },
    { username: "rookline", display_name: "Player", rating: 9000 },
    { username: 1, display_name: "Player" },
  ])("rejects malformed/privileged update %#", (value) => {
    expect(parseProfileEdit(value).ok).toBe(false);
  });
});
