import { describe, expect, it } from "vitest";
import { resolveStagingAppOrigin } from "../e2e/staging-target";

describe("dedicated staging browser target", () => {
  it("uses local development when no public target is provided", () => {
    expect(resolveStagingAppOrigin(undefined)).toBe("http://127.0.0.1:3100");
  });

  it("accepts a public HTTPS origin and explicit HTTP loopback", () => {
    expect(resolveStagingAppOrigin("https://staging.rookline.example")).toBe("https://staging.rookline.example");
    expect(resolveStagingAppOrigin("http://localhost:3100")).toBe("http://localhost:3100");
  });

  it("rejects non-HTTPS remote targets and misleading origins", () => {
    for (const value of [
      "http://staging.rookline.example", "https://staging.rookline.example/",
      "https://staging.rookline.example/game", "https://staging.rookline.example?x=1",
      "https://user:password@staging.rookline.example", "ftp://staging.rookline.example",
      "//staging.rookline.example", "not a URL", "",
    ]) expect(() => resolveStagingAppOrigin(value)).toThrow(/ROOKLINE_STAGING_APP_ORIGIN/);
  });
});
