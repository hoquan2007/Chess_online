import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseSpectatorConsent, parseSpectatorSnapshot, spectatorReplay } from './spectators';

const id = '00000000-0000-4000-8000-000000000001';
const spectator = (changes: Record<string, unknown> = {}) => ({
  role: 'spectator',
  serverNow: 1_790_000_000_000,
  game: {
    id, status: 'active', fen: new Chess().fen(), pgn: '', ply: 0, turn: 'w',
    base_ms: 300_000, increment_ms: 0, white_ms: 300_000, black_ms: 300_000,
    clock_anchor_at: '2026-11-05T00:00:00Z', result: null,
    ...changes,
  },
});

describe('spectator response validation', () => {
  it('accepts only consistent, replayable public chess states', () => {
    expect(parseSpectatorSnapshot(spectator(), id)?.game.ply).toBe(0);
    const chess = new Chess();
    chess.move('e4');
    expect(parseSpectatorSnapshot(spectator({ fen: chess.fen(), pgn: chess.pgn(), turn: 'b', ply: 1 }), id)?.game.turn).toBe('b');
    expect(parseSpectatorSnapshot(spectator({ fen: chess.fen(), pgn: '', ply: 1 }), id)).toBeNull();
  });

  it('rejects private identity, oversized ledgers and invalid timing payloads', () => {
    expect(parseSpectatorSnapshot({ role: 'player', game: spectator().game }, id)).toBeNull();
    expect(parseSpectatorSnapshot(spectator(), '00000000-0000-4000-8000-000000000002')).toBeNull();
    expect(parseSpectatorSnapshot(spectator({ pgn: 'N'.repeat(100_001) }), id)).toBeNull();
    expect(parseSpectatorSnapshot(spectator({ white_ms: -4 }), id)).toBeNull();
    expect(parseSpectatorSnapshot(spectator({ clock_anchor_at: 'not a date' }), id)).toBeNull();
    expect(parseSpectatorSnapshot({ ...spectator(), serverNow: 'wrong' }, id)).toBeNull();
  });

  it('accepts consent only when both flags agree with the computed open state', () => {
    expect(parseSpectatorConsent({ role: 'player', enabled: true, otherEnabled: true, open: true })?.open).toBe(true);
    expect(parseSpectatorConsent({ role: 'player', enabled: false, otherEnabled: true, open: false })?.open).toBe(false);
    expect(parseSpectatorConsent({ role: 'player', enabled: false, otherEnabled: false, open: true })).toBeNull();
    expect(parseSpectatorConsent({ role: 'spectator', enabled: true, otherEnabled: true, open: true })).toBeNull();
  });

  it('rebuilds every spectator replay position from a verified PGN ledger', () => {
    const chess = new Chess();
    const positions = [chess.fen()];
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) {
      chess.move(san);
      positions.push(chess.fen());
    }
    const input = spectator({ fen: chess.fen(), pgn: chess.pgn(), turn: chess.turn(), ply: 4 });
    const parsed = parseSpectatorSnapshot(input, id);
    expect(parsed).not.toBeNull();
    const replay = spectatorReplay(parsed!.game);
    expect(replay.positions).toEqual(positions);
    expect(replay.moves.map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(() => spectatorReplay({ ...parsed!.game, pgn: '1. e4 e5' })).toThrow('Game ledger is inconsistent');
  });
});
