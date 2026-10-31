import { readPuzzleCompletions, readPuzzlePractice, type PuzzlePractice } from "./puzzles";

export type PuzzleProgress = { completed: string[]; practice: PuzzlePractice };

const backupKind = "rookline-puzzles";
const backupVersion = 1;
export const maxPuzzleBackupBytes = 64 * 1024;

/** A portable, versioned backup containing only supported puzzle identifiers. */
export function exportPuzzleProgress(progress: PuzzleProgress): string {
  return JSON.stringify({
    kind: backupKind,
    version: backupVersion,
    completed: readPuzzleCompletions(progress.completed),
    practice: readPuzzlePractice(progress.practice),
  }, null, 2);
}

/** Reject unrelated files and unsupported future formats before touching storage. */
export function parsePuzzleProgress(raw: string): PuzzleProgress {
  if (new TextEncoder().encode(raw).length > maxPuzzleBackupBytes) throw new Error("Backup is larger than 64 KB.");
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, "")); }
  catch { throw new Error("This is not a valid JSON backup."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a Rookline puzzle backup.");
  const data = value as Record<string, unknown>;
  if (data.kind !== backupKind || data.version !== backupVersion ||
      !Array.isArray(data.completed) || !data.practice || typeof data.practice !== "object" || Array.isArray(data.practice)) {
    throw new Error("This is not a supported Rookline puzzle backup.");
  }
  return { completed: readPuzzleCompletions(data.completed), practice: readPuzzlePractice(data.practice) };
}

/** Keep existing completions and the highest bounded practice count for each ID. */
export function mergePuzzleProgress(existing: PuzzleProgress, incoming: PuzzleProgress): PuzzleProgress {
  const completed = readPuzzleCompletions([...existing.completed, ...incoming.completed]);
  const a = readPuzzlePractice(existing.practice);
  const b = readPuzzlePractice(incoming.practice);
  const practice: PuzzlePractice = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    practice[id] = {
      errors: Math.max(a[id]?.errors ?? 0, b[id]?.errors ?? 0),
      hints: Math.max(a[id]?.hints ?? 0, b[id]?.hints ?? 0),
      solves: Math.max(a[id]?.solves ?? 0, b[id]?.solves ?? 0),
    };
  }
  return { completed, practice };
}
