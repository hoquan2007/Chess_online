import { Chess } from "chess.js";

export const localArchiveKey = "rookline-history";
export const maxLocalArchiveBytes = 2_000_000;

export type StoredLocalGame = {
  id: string;
  pgn: string;
  outcome: string;
  mode: "local" | "computer";
  date: string;
};

function isStoredGame(value: unknown): value is StoredLocalGame {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<StoredLocalGame>;
  return typeof game.id === "string" && game.id.startsWith("local-") && game.id.length <= 80 &&
    typeof game.pgn === "string" && game.pgn.length <= 100_000 &&
    typeof game.outcome === "string" && game.outcome.length <= 160 &&
    (game.mode === "local" || game.mode === "computer") &&
    typeof game.date === "string" && Number.isFinite(Date.parse(game.date));
}

function uniqueGames(values: unknown[]): StoredLocalGame[] {
  const seen = new Set<string>();
  return values.filter((value): value is StoredLocalGame => {
    if (!isStoredGame(value) || seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

/** Local storage is editable by the browser owner and may contain legacy/broken entries. */
export function parseStoredLocalGames(raw: string): StoredLocalGame[] {
  if (raw.length > maxLocalArchiveBytes) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? uniqueGames(parsed.slice(0, 80)) : [];
  } catch { return []; }
}

function isPlayablePgn(game: StoredLocalGame) {
  try { new Chess().loadPgn(game.pgn); return true; }
  catch { return false; }
}

const backupFormat = "rookline-local-game-archive";

/** Export only replayable games so that a backup we create can always be reimported. */
export function serializeLocalGameBackup(games: StoredLocalGame[]) {
  const playable = uniqueGames(games.slice(0, 80)).filter(isPlayablePgn);
  const content = JSON.stringify({ format: backupFormat, version: 1, games: playable }, null, 2);
  if (content.length > maxLocalArchiveBytes) throw new Error("Archive is too large to back up as one file.");
  return { content, exported: playable.length, skipped: games.length - playable.length };
}

/** An imported file is untrusted: reject oversized, partial and illegal PGN records. */
export function parseLocalGameBackup(raw: string): StoredLocalGame[] {
  if (raw.length > maxLocalArchiveBytes) throw new Error("Backup exceeds the 2 MB limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Backup is not valid JSON."); }
  if (!parsed || typeof parsed !== "object") throw new Error("Unrecognized Rookline backup.");
  const backup = parsed as { format?: unknown; version?: unknown; games?: unknown };
  if (backup.format !== backupFormat || backup.version !== 1 || !Array.isArray(backup.games) || backup.games.length > 80) {
    throw new Error("Unrecognized Rookline backup.");
  }
  const games = uniqueGames(backup.games);
  if (games.length !== backup.games.length || games.some((game) => !isPlayablePgn(game))) {
    throw new Error("Backup contains invalid or duplicate games.");
  }
  return games;
}

/** Preserve records already on this device when an imported ID conflicts. */
export function mergeLocalGameArchives(existing: StoredLocalGame[], imported: StoredLocalGame[]) {
  const merged = uniqueGames([...existing, ...imported]).slice(0, 80);
  return { games: merged, added: merged.length - uniqueGames(existing).slice(0, 80).length };
}
