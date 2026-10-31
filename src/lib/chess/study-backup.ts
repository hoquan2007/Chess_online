import { sanitizeStudyCompletions } from "./study-progress";

const kind = "rookline-study";
const version = 1;
export const maxStudyBackupBytes = 64 * 1024;

/** A portable, versioned list of mastered opening and lesson sides. */
export function exportStudyProgress(completed: readonly string[]): string {
  return JSON.stringify({ kind, version, completed: sanitizeStudyCompletions(completed) }, null, 2);
}

/** Validate the envelope before allowing any imported entries into local progress. */
export function parseStudyProgress(raw: string): string[] {
  if (new TextEncoder().encode(raw).length > maxStudyBackupBytes) {
    throw new Error("Backup is larger than 64 KB.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^\uFEFF/, "")); }
  catch { throw new Error("This is not a valid JSON backup."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("This is not a Rookline study backup.");
  }
  const data = parsed as Record<string, unknown>;
  if (data.kind !== kind || data.version !== version || !Array.isArray(data.completed)) {
    throw new Error("This is not a supported Rookline study backup.");
  }
  return sanitizeStudyCompletions(data.completed);
}
