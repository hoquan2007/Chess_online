import { describe, expect, it } from "vitest";
import { rejectCrossOrigin } from "./request-origin";

const request = (headers?: HeadersInit) => new Request("https://rookline.example/api/games", { method: "POST", headers });

describe("browser mutation origin checks", () => {
  it("permits same-origin browser requests", () => {
    expect(rejectCrossOrigin(request({ Origin: "https://rookline.example", "Sec-Fetch-Site": "same-origin" }))).toBeNull();
  });
  it("rejects requests from a third-party origin", () => {
    expect(rejectCrossOrigin(request({ Origin: "https://evil.example" }))?.status).toBe(403);
  });
  it("rejects explicit cross-site fetch metadata even when Origin is missing", () => {
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "cross-site" }))?.status).toBe(403);
  });
  it("denies mutations lacking both origin and same-origin fetch metadata", () => {
    expect(rejectCrossOrigin(request())?.status).toBe(403);
  });
  it("denies same-site sibling requests without a matching origin", () => {
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "same-site" }))?.status).toBe(403);
  });
  it("permits requests with trustworthy same-origin fetch metadata and no origin", () => {
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "same-origin" }))).toBeNull();
  });
  it("rejects a conflicting origin even if fetch metadata claims same-origin", () => {
    expect(rejectCrossOrigin(request({ Origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" }))?.status).toBe(403);
  });
  it("rejects opaque, malformed and non-HTTP origins", () => {
    for (const origin of ["null", "https://rookline.example/extra", "https://user@rookline.example", "file://rookline.example", "https://rookline.example https://evil.example"]) {
      expect(rejectCrossOrigin(request({ Origin: origin }))?.status).toBe(403);
    }
  });
  it("rejects sibling-host requests even with same-site fetch metadata", () => {
    expect(rejectCrossOrigin(request({ Origin: "https://sibling.rookline.example", "Sec-Fetch-Site": "same-site" }))?.status).toBe(403);
  });
  it("uses received Host when Next normalizes the URL to localhost", () => {
    const normalized = new Request("http://localhost:3100/api/games", {
      method: "POST", headers: { Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100" },
    });
    expect(rejectCrossOrigin(normalized)).toBeNull();
  });
  it("denies Host/Origin mismatches, including a different port or protocol", () => {
    expect(rejectCrossOrigin(request({ Host: "rookline.example", Origin: "https://evil.example" }))?.status).toBe(403);
    expect(rejectCrossOrigin(request({ Host: "rookline.example:443", Origin: "https://rookline.example:444" }))?.status).toBe(403);
    expect(rejectCrossOrigin(request({ Host: "rookline.example", Origin: "http://rookline.example" }))?.status).toBe(403);
  });
  it("denies cross-site metadata even when Host matches Origin", () => {
    expect(rejectCrossOrigin(request({ Host: "rookline.example", Origin: "https://rookline.example", "Sec-Fetch-Site": "cross-site" }))?.status).toBe(403);
  });
});
