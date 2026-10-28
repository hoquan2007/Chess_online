import { describe, expect, it } from "vitest";
import { readLimitedJson } from "./request-json";

function request(body: string, headers: HeadersInit = {}) {
  return new Request("https://rookline.example/api/games", { method: "POST", body, headers });
}

describe("bounded JSON ingestion", () => {
  it("accepts valid small payloads", async () => {
    expect(await readLimitedJson(request('{"control":"5+0"}'), 128)).toEqual({ ok: true, data: { control: "5+0" } });
  });
  it("rejects forged short content length and enforces actual bytes", async () => {
    const result = await readLimitedJson(request('{"padding":"' + "x".repeat(1024) + '"}', { "Content-Length": "1" }), 100);
    expect(result).toMatchObject({ ok: false, status: 413 });
  });
  it("uses UTF-8 bytes rather than JavaScript code units", async () => {
    const result = await readLimitedJson(request(JSON.stringify({ message: "♟♟♟♟" })), 18);
    expect(result).toMatchObject({ ok: false, status: 413 });
  });
  it("rejects invalid syntax and empty requests", async () => {
    expect(await readLimitedJson(request("{"), 50)).toMatchObject({ ok: false, status: 400 });
    expect(await readLimitedJson(new Request("https://rookline.example", { method: "POST" }), 50)).toMatchObject({ ok: false, status: 400 });
  });
  it("rejects malformed Content-Length before parsing", async () => {
    expect(await readLimitedJson(request("{}", { "Content-Length": "-1" }), 50)).toMatchObject({ ok: false, status: 400 });
  });
});
