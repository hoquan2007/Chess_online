import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261029060000_locked_move_and_claim_clocks.sql"),
  "utf8",
);
const playerSnapshotMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261105020000_service_only_player_game_snapshot.sql"),
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

describe("service-only player snapshot SQL safety", () => {
  it("does not lock an active, healthy unrated game's read path", () => {
    const firstRead = playerSnapshotMigration.indexOf("select * into g from public.games where id = p_game;");
    const playerCheck = playerSnapshotMigration.indexOf("if p_player is null or");
    const activeCheck = playerSnapshotMigration.indexOf("if g.status = 'active' then");
    const fallback = playerSnapshotMigration.indexOf("perform public.rookline_expire_game(p_game);");

    expect(firstRead).toBeGreaterThan(0);
    expect(playerCheck).toBeGreaterThan(firstRead);
    expect(activeCheck).toBeGreaterThan(playerCheck);
    expect(fallback).toBeGreaterThan(activeCheck);
    expect(playerSnapshotMigration.slice(firstRead, fallback)).not.toMatch(/for update/i);
    expect(playerSnapshotMigration.slice(activeCheck, fallback)).toMatch(/g\.rated/);
    expect(playerSnapshotMigration.slice(activeCheck, fallback)).toMatch(/g\.clock_anchor_at is null/);
    expect(playerSnapshotMigration.slice(activeCheck, fallback)).toMatch(/60000 >= v_remaining/);
  });

  it("re-reads after authoritative settlement, rechecks the seat, and restricts RPC grants", () => {
    const settlement = playerSnapshotMigration.indexOf("perform public.rookline_expire_game(p_game);");
    const latest = playerSnapshotMigration.indexOf("select * into g from public.games where id = p_game;", settlement);
    const seatRecheck = playerSnapshotMigration.indexOf("p_player is distinct from g.white_id", latest);

    expect(latest).toBeGreaterThan(settlement);
    expect(seatRecheck).toBeGreaterThan(latest);
    expect(playerSnapshotMigration).toMatch(/revoke all on function public\.rookline_read_player_game\(uuid,uuid\)\s+from public, anon, authenticated;/);
    expect(playerSnapshotMigration).toMatch(/grant execute on function public\.rookline_read_player_game\(uuid,uuid\) to service_role;/);
  });
});
