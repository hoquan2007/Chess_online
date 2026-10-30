import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("post-auth redirect isolation", () => {
  const origin = "https://rookline.example";

  it("retains internal paths with search params and fragments", () => {
    for (const path of ["/play/local", "/play/online?mode=friend", "/game/123#moves", "/?tab=learn"]) {
      expect(safeNext(path)).toBe(path);
      expect(new URL(safeNext(path), origin).origin).toBe(origin);
    }
  });

  it("rejects protocol-relative and absolute external destinations", () => {
    for (const input of ["//evil.example", "///evil.example", "https://evil.example", "\\\\evil.example", "/\\evil.example", " /play/local", ""]) {
      expect(safeNext(input)).toBe("/play/online");
    }
    expect(safeNext(null)).toBe("/play/online");
    expect(safeNext(undefined)).toBe("/play/online");
  });

  it("rejects URL-parser whitespace that can turn a path into an external redirect", () => {
    // The first value passed the old guard and became https://evil.example/.
    for (const input of ["/\t/evil.example", "/\r/evil.example", "/\n/evil.example", "/\u0000/evil.example", "/\u001f/evil.example", "/\u007f/evil.example"]) {
      expect(safeNext(input)).toBe("/play/online");
      expect(new URL(safeNext(input), origin).origin).toBe(origin);
    }
  });
});
