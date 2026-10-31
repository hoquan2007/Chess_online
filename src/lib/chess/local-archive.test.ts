import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  maxLocalArchiveBytes,
  mergeLocalGameArchives,
  parseLocalGameBackup,
  parseStoredLocalGames,
  serializeLocalGameBackup,
  type StoredLocalGame,
} from "./local-archive";

const first = (() => {
  const chess = new Chess();
  chess.move("e4");
  return { id: "local-123", pgn: chess.pgn(), outcome: "White won", mode: "local" as const, date: "2026-10-31T00:00:00.000Z" };
})();
const second: StoredLocalGame = { ...first, id: "local-456", mode: "computer", outcome: "Draw" };

describe("local game archive backups", () => {
  it("backs up replayable games with a version and restores full game records", () => {
    const { content, exported, skipped } = serializeLocalGameBackup([first, second]);
    expect([exported, skipped]).toEqual([2, 0]);
    expect(parseLocalGameBackup(content)).toEqual([first, second]);
    expect(JSON.parse(content)).toMatchObject({ format: "rookline-local-game-archive", version: 1 });
  });

  it("skips damaged entries on export and refuses tampered backups on import", () => {
    const damaged = { ...first, id: "local-bad", pgn: "1. invalidSAN" };
    const { content, exported, skipped } = serializeLocalGameBackup([first, damaged]);
    expect([exported, skipped]).toEqual([1, 1]);
    expect(parseLocalGameBackup(content)).toEqual([first]);
    const parsed = JSON.parse(content);
    parsed.games[0].pgn = "1. invalidSAN";
    expect(() => parseLocalGameBackup(JSON.stringify(parsed))).toThrow(/invalid or duplicate/);
    parsed.games[0].pgn = first.pgn;
    parsed.games.push(first);
    expect(() => parseLocalGameBackup(JSON.stringify(parsed))).toThrow(/invalid or duplicate/);
  });

  it("rejects unknown format, oversized input, invalid fields and partial JSON", () => {
    expect(() => parseLocalGameBackup("{")).toThrow(/valid JSON/);
    expect(() => parseLocalGameBackup(" ".repeat(maxLocalArchiveBytes + 1))).toThrow(/2 MB/);
    expect(() => parseLocalGameBackup(JSON.stringify({ version: 1, games: [first] }))).toThrow(/Unrecognized/);
    expect(() => parseLocalGameBackup(JSON.stringify({ format: "rookline-local-game-archive", version: 2, games: [first] }))).toThrow(/Unrecognized/);
    expect(() => parseLocalGameBackup(JSON.stringify({ format: "rookline-local-game-archive", version: 1, games: [{ ...first, id: "other" }] }))).toThrow(/invalid or duplicate/);
    expect(() => parseLocalGameBackup(JSON.stringify({ format: "rookline-local-game-archive", version: 1, games: Array(81).fill(first) }))).toThrow(/Unrecognized/);
  });

  it("keeps the device's records on conflict and respects the 80-game cap", () => {
    const modified = { ...first, outcome: "Imported conflicting result" };
    expect(mergeLocalGameArchives([first], [modified, second])).toEqual({ games: [first, second], added: 1 });
    const existing = Array.from({ length: 79 }, (_, index) => ({ ...first, id: `local-${index}` }));
    const { games, added } = mergeLocalGameArchives(existing, [second, { ...second, id: "local-extra" }]);
    expect(games).toHaveLength(80);
    expect(added).toBe(1);
    expect(games[79]).toEqual(second);
  });

  it("tolerates damaged localStorage and deduplicates legacy records", () => {
    expect(parseStoredLocalGames("{")).toEqual([]);
    expect(parseStoredLocalGames(" ".repeat(maxLocalArchiveBytes + 1))).toEqual([]);
    expect(parseStoredLocalGames(JSON.stringify([first, first, { ...first, date: "bad" }, second]))).toEqual([first, second]);
  });
});
