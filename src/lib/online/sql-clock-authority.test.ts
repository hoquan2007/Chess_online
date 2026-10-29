import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261029060000_locked_move_and_claim_clocks.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} migration must exist`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("end $$;", start);
  expect(end, `${name} function must end`).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("source guard for authoritative PostgreSQL clocks", () => {
  it.each(["rookline_commit_move", "rookline_claim_draw", "rookline_expire_game"])(
    "%s samples trusted time only after acquiring the game-row lock",
    (name) => {
      const body = functionBody(name);
      const lock = body.indexOf("for update;");
      const clockSample = body.indexOf("v_now := clock_timestamp();");
      expect(lock).toBeGreaterThan(0);
      expect(clockSample).toBeGreaterThan(lock);
      expect(body).toMatch(/v_now timestamptz\s*;/);
      expect(body).toMatch(/v_elapsed bigint\s*;/);
      expect(body).not.toMatch(/v_now timestamptz\s*:=/);
    },
  );
});
