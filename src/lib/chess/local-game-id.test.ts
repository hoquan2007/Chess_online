import { describe, expect, it } from "vitest";
import { createLocalGameId } from "./local-game-id";

describe("local game IDs", () => {
  it("creates unique, storage-compatible identifiers for rapid consecutive games", () => {
    const ids = Array.from({ length: 256 }, () => createLocalGameId());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
    expect(ids.every((id) => id.length <= 80)).toBe(true);
  });
});
