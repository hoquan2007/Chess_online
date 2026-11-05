import { beforeEach, describe, expect, it, vi } from 'vitest';

const alice = '10000000-0000-4000-8000-000000000001';
const eventId = '20000000-0000-4000-8000-000000000002';
const rpc = vi.fn();
const getUser = vi.fn();
const serverSupabase = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ serverSupabase: () => serverSupabase() }));

import { GET, POST } from './route';

function write(data: unknown, headers: Record<string, string> = {}) {
  return new Request('https://rookline.example/api/tournaments', {
    method: 'POST', body: JSON.stringify(data), headers: {
      host: 'rookline.example', origin: 'https://rookline.example',
      'Content-Type': 'application/json', 'X-Rookline-Account': alice, ...headers,
    },
  });
}

describe('S5 tournament API security and registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null });
    serverSupabase.mockResolvedValue({ auth: { getUser }, rpc });
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it('returns an account-bound private aggregate without entrant identities', async () => {
    const result = await GET();
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toEqual({ accountId: alice, tournaments: [] });
    expect(rpc).toHaveBeenCalledWith('rookline_tournament_list');
  });

  it('only passes signed-in account action inputs to database RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'joined', error: null });
    const response = await POST(write({ action: 'join', tournamentId: eventId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'joined' });
    expect(rpc).toHaveBeenCalledWith('rookline_tournament_action', { p_action: 'join', p_tournament: eventId });
  });

  it('checks CSRF before authentication and rejects an account change', async () => {
    expect((await POST(write({ action: 'join', tournamentId: eventId }, { origin: 'https://other.example' }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect((await POST(write({ action: 'join', tournamentId: eventId }, { 'X-Rookline-Account': eventId }))).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects payload smuggling and overly large requests', async () => {
    expect((await POST(write({ action: 'join', tournamentId: eventId, creator: alice }))).status).toBe(422);
    expect((await POST(write({ action: 'create', title: 't'.repeat(1400) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when no Supabase server or authenticated session exists', async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write({ action: 'join', tournamentId: eventId }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps capacity, time and rate-limit races without leaking database errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'tournament_full' } });
    expect((await POST(write({ action: 'join', tournamentId: eventId }))).status).toBe(409);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'tournament_rate_limited' } });
    expect((await POST(write({ action: 'join', tournamentId: eventId }))).status).toBe(429);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE SQL DETAIL' } });
    const result = await POST(write({ action: 'join', tournamentId: eventId }));
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain('PRIVATE SQL DETAIL');
  });
});
