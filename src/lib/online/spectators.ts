import { Chess } from 'chess.js';
import { replayGame } from '@/lib/online/games';

export type SpectatorGame = {
  id: string;
  status: 'active' | 'completed';
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  ply: number;
  base_ms: number;
  increment_ms: number;
  white_ms: number;
  black_ms: number;
  clock_anchor_at: string | null;
  result: string | null;
};

export type SpectatorSnapshot = { role: 'spectator'; game: SpectatorGame; serverNow: number };
export type SpectatorConsentState = { role: 'player'; enabled: boolean; otherEnabled: boolean; open: boolean };

/** All historical boards come from the same verified server PGN as the live board. */
export function spectatorReplay(game: SpectatorGame) {
  const verified = replayGame(game);
  const moves = verified.history({ verbose: true });
  const board = new Chess();
  const positions = [board.fen()];
  for (const move of moves) {
    board.move(move.san);
    positions.push(board.fen());
  }
  return { positions, moves };
}

export function parseSpectatorConsent(value: unknown): SpectatorConsentState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<SpectatorConsentState>;
  if (state.role !== 'player' || typeof state.enabled !== 'boolean' ||
      typeof state.otherEnabled !== 'boolean' || typeof state.open !== 'boolean' ||
      state.open !== (state.enabled && state.otherEnabled)) return null;
  return { role: 'player', enabled: state.enabled, otherEnabled: state.otherEnabled, open: state.open };
}

export function parseSpectatorSnapshot(value: unknown, expectedId: string): SpectatorSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as { role?: unknown; game?: Partial<SpectatorGame>; serverNow?: unknown };
  const g = payload.game;
  if (payload.role !== 'spectator' || !g || g.id !== expectedId ||
      (g.status !== 'active' && g.status !== 'completed') ||
      typeof g.fen !== 'string' || g.fen.length > 120 ||
      typeof g.pgn !== 'string' || g.pgn.length > 100_000 ||
      !Number.isSafeInteger(g.ply) || g.ply! < 0 || g.ply! > 30_000 ||
      (g.turn !== 'w' && g.turn !== 'b') ||
      ![g.base_ms, g.increment_ms, g.white_ms, g.black_ms].every((n) =>
        Number.isSafeInteger(n) && typeof n === 'number' && n >= 0 && n <= 86_400_000) ||
      (g.clock_anchor_at !== null &&
        (typeof g.clock_anchor_at !== 'string' || g.clock_anchor_at.length > 64 || !Number.isFinite(Date.parse(g.clock_anchor_at)))) ||
      (g.result !== null && (typeof g.result !== 'string' || g.result.length > 200)) ||
      !Number.isSafeInteger(payload.serverNow)) return null;
  try { replayGame(g as SpectatorGame); } catch { return null; }
  return { role: 'spectator', game: g as SpectatorGame, serverNow: payload.serverNow as number };
}
