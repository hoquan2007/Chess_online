import { describe, expect, it } from "vitest";
import { parseAccountPreferences } from "./preferences";

describe("account preferences", () => {
  it("accepts exactly the two supported preferences", () => {
    expect(parseAccountPreferences({ sounds_enabled: false, theme: "light" }))
      .toEqual({ ok: true, value: { theme: "light", sounds_enabled: false } });
  });

  it.each([null, [], {}, { theme: "auto", sounds_enabled: true },
    { theme: "dark", sounds_enabled: "yes" }, { theme: "dark" },
    { theme: "light", sounds_enabled: true, user_id: "another-user" },
    { theme: "dark", sounds_enabled: true, rating: 9999 }])
  ("rejects invalid or privileged preferences %#", (candidate) => {
    expect(parseAccountPreferences(candidate).ok).toBe(false);
  });
});
