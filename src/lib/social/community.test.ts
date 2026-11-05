import { describe, expect, it } from 'vitest';
import { parseTournamentWrite, parseReportWrite, parseModerationWrite } from './community';

const eventId = '10000000-0000-4000-8000-000000000001';

describe('S5 community input contracts', () => {
  it('requires an exact bounded tournament creation payload', () => {
    const create = { action: 'create', title: 'Rookline Open', description: '',
      startsAt: '2026-12-01T10:00:00.000Z', capacity: 16 };
    expect(parseTournamentWrite(create)).toEqual(create);
    for (const invalid of [{ ...create, capacity: 65 }, { ...create, title: '  padded  ' },
      { ...create, startsAt: 'tomorrow' }, { ...create, organizerId: eventId },
      { ...create, startsAt: '2026-02-30T10:00:00.000Z' }]) {
      expect(parseTournamentWrite(invalid)).toBeNull();
    }
  });

  it('accepts only a valid event ID and a known registration action', () => {
    expect(parseTournamentWrite({ action: 'join', tournamentId: eventId })).toEqual({ action: 'join', tournamentId: eventId });
    expect(parseTournamentWrite({ action: 'finish', tournamentId: eventId })).toBeNull();
    expect(parseTournamentWrite({ action: 'cancel', tournamentId: 'wrong-id' })).toBeNull();
  });

  it('rejects spoofed report actors, unknown categories and insufficient detail', () => {
    const report = { username: 'opponent_23', category: 'cheating', details: 'Suspicious moves throughout this match.' };
    expect(parseReportWrite(report)).toEqual(report);
    expect(parseReportWrite({ ...report, reporterId: eventId })).toBeNull();
    expect(parseReportWrite({ ...report, category: 'admin' })).toBeNull();
    expect(parseReportWrite({ ...report, details: 'Too short' })).toBeNull();
    expect(parseReportWrite({ ...report, details: 'x'.repeat(501) })).toBeNull();
  });

  it('rejects forged moderation decisions, extra fields and unsafe report IDs', () => {
    expect(parseModerationWrite({ reportId: 20, decision: 'resolved' })).toEqual({ reportId: 20, decision: 'resolved' });
    expect(parseModerationWrite({ reportId: 20, decision: 'delete' })).toBeNull();
    expect(parseModerationWrite({ reportId: 20, decision: 'dismissed', moderatorId: eventId })).toBeNull();
    expect(parseModerationWrite({ reportId: Number.MAX_SAFE_INTEGER + 1, decision: 'resolved' })).toBeNull();
  });
});
