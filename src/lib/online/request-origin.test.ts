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
  it("allows non-browser requests that provide neither browser header", () => {
    expect(rejectCrossOrigin(request())).toBeNull();
  });
});
