import { describe, expect, it } from 'vitest';
import { createRoundRobinPlan } from './tournament-rounds';
import {
  exportTournamentScheduleCsv,
  exportTournamentStandingsCsv,
  maxTournamentDraftBytes,
  parseTournamentDraft,
  serializeTournamentDraft,
} from './tournament-draft';

describe('unrated tournament draft portability', () => {
  it('round-trips a generated odd-player schedule and scores without trusting imported fixtures', () => {
    const plan = createRoundRobinPlan(['An', 'Binh', 'Chi', 'Dung', 'Em']);
    const results = { [plan.rounds[0].matches[0].id]: 'white' as const,
      [plan.rounds[1].matches[0].id]: 'draw' as const };
    const serialized = serializeTournamentDraft(plan, results);
    expect(serialized).toContain('rookline.round-robin-practice');
    expect(JSON.parse(serialized)).not.toHaveProperty('rounds');
    expect(parseTournamentDraft(serialized)).toEqual({ plan, results });
    expect(serializeTournamentDraft(plan, results)).toBe(serialized);
  });

  it('rejects manipulated, unsupported and oversized drafts instead of accepting forged results', () => {
    const plan = createRoundRobinPlan(['A', 'B', 'C', 'D']);
    const base = JSON.parse(serializeTournamentDraft(plan, {})) as Record<string, unknown>;
    for (const alteration of [
      { version: 2 }, { format: 'other' }, { players: ['A', 'B', 'C', 'a'] },
      { players: ['A', 'B', 'C'] }, { players: [1, 'B', 'C', 'D'] },
      { results: { 'r99-m1': 'white' } }, { results: { 'r1-m1': 'pending' } },
      { results: [] }, { rounds: [{ number: 1, matches: [] }] },
    ]) {
      expect(() => parseTournamentDraft(JSON.stringify({ ...base, ...alteration }))).toThrow();
    }
    expect(() => parseTournamentDraft('{bad')).toThrow('not valid JSON');
    expect(() => parseTournamentDraft('x'.repeat(maxTournamentDraftBytes + 1))).toThrow('16 KB');
    expect(() => serializeTournamentDraft(plan, { 'r99-m1': 'white' })).toThrow('unknown match');
  });

  it('exports standings and bye-aware schedule as spreadsheet-safe CSV', () => {
    const plan = createRoundRobinPlan(['=1+2', 'Alice, "Queen"', '-Carol', 'Dung', 'Em']);
    const results = { [plan.rounds[0].matches[0].id]: 'black' as const };
    const standings = exportTournamentStandingsCsv(plan, results);
    const schedule = exportTournamentScheduleCsv(plan, results);
    expect(standings).toMatch(/^\uFEFF"Rank","Player"/);
    expect(standings).toContain('"\'=1+2"');
    expect(standings).toContain('"Alice, ""Queen"""');
    expect(standings).toContain('"\'-Carol"');
    expect(schedule).toContain('"0-1"');
    expect(schedule).toContain('"Bye"');
    expect(schedule.match(/\r\n/g)).toHaveLength(16); // 15 rounds/bye rows for 5 entrants + header
  });
});
