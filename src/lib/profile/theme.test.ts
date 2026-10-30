import { afterEach, describe, expect, it, vi } from "vitest";
import { readTheme, writeTheme } from "./theme";

afterEach(() => vi.unstubAllGlobals());

describe("theme preference when storage is unavailable", () => {
  it("uses the saved choice when storage is readable", () => {
    const storage = { getItem: vi.fn(() => "light"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    expect(readTheme()).toBe("light");
    expect(writeTheme("dark")).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("rookline-theme", "dark");
  });

  it("keeps an in-memory choice when both reads and writes are rejected", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new DOMException("Storage disabled", "SecurityError"); },
      setItem: () => { throw new DOMException("Storage disabled", "SecurityError"); },
    });
    expect(writeTheme("light")).toBe(false);
    expect(readTheme()).toBe("light");
    expect(writeTheme("dark")).toBe(false);
    expect(readTheme()).toBe("dark");
  });

  it("ignores invalid stored values rather than applying them", () => {
    vi.stubGlobal("localStorage", { getItem: () => "invalid", setItem: vi.fn() });
    writeTheme("light");
    expect(readTheme()).toBe("light");
  });
});
