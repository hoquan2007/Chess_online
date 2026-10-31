// Local integrity check against the nine SQL texts recorded in Rookline's
// dedicated staging migration history on 2026-10-31. This has no network or
// database access; run a read-only remote migration query before any db push.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const snapshot = JSON.parse(
  readFileSync(new URL("../docs/agent-state/STAGING_MIGRATION_HISTORY_SNAPSHOT_2026-10-31.json", import.meta.url), "utf8"),
);
const migrations = snapshot.migrations;
if (
  snapshot.project_ref !== "tyvczicinpjixmxgjhjn" ||
  migrations.length !== 9 ||
  new Set(migrations.map((entry) => entry.remote_version)).size !== 9 ||
  new Set(migrations.map((entry) => entry.local_version)).size !== 9
) {
  throw new Error("Staging migration backup is missing or has duplicate/mismatched entries.");
}
const staging = migrations.map(({ local_version, name, sql_md5 }) => [
  `${local_version}_${name}.sql`,
  sql_md5,
]);

let mismatches = 0;
for (const [filename, expectedHash] of staging) {
  try {
    const source = readFileSync(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
    // The remote Supabase MCP stored each migration as one SQL statement,
    // excluding the local file's single trailing LF.
    const recordedStatement = source.endsWith("\n") ? source.slice(0, -1) : source;
    const actualHash = createHash("md5").update(recordedStatement, "utf8").digest("hex");
    if (actualHash !== expectedHash) {
      console.error(`MISMATCH ${filename}: expected ${expectedHash}, got ${actualHash}`);
      mismatches++;
    }
  } catch (error) {
    console.error(`MISSING/UNREADABLE ${filename}: ${error.message}`);
    mismatches++;
  }
}

if (mismatches) {
  console.error(`Staging migration snapshot parity FAILED: ${mismatches}/${staging.length} differences.`);
  process.exitCode = 1;
} else {
  console.log(`Staging migration snapshot parity PASS: ${staging.length}/${staging.length} source SQL hashes match the 2026-10-31 remote record.`);
  console.log("Remote state was not queried. Confirm remote migration versions and SQL before any future db push.");
}
