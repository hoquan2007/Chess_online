// Local integrity check against the nine SQL texts recorded in Rookline's
// dedicated staging migration history on 2026-10-31. This has no network or
// database access; run the read-only remote SQL in the evidence ledger to
// verify the live database again before any migration operation.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const staging = [
  ["20261029010000_foundation.sql", "b5d6b3e742ee2534f49d058dcf369524"],
  ["20261029020000_game_rate_limits.sql", "0dfc11a03a976913da862d126866d3ab"],
  ["20261029030000_draw_claims.sql", "f029025cc771bb5be8dc9c30dd034717"],
  ["20261029040000_resignation_clock_authority.sql", "bb9f1f617d07713405b98bf3a20eac2b"],
  ["20261029050000_mating_potential_adjudication.sql", "66d04564039890fd6f1da31c43fefd59"],
  ["20261029060000_locked_move_and_claim_clocks.sql", "47e557c2d9a017b259314fafc310c904"],
  ["20261029070000_profile_privilege_hardening.sql", "70da3a8df910427b4ea0d4e10ebb330e"],
  ["20261029080000_event_trigger_and_fk_indexes.sql", "f0c2f56df7bac6f00f8f84c6d614305f"],
  ["20261029090000_cancel_waiting_challenge.sql", "f349f5fd616880c0800892e106e8399f"],
];

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
  console.log("Remote state was not queried. Different migration version IDs still prohibit an unreconciled db push.");
}
