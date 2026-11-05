import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverSupabase } from '@/lib/supabase/server';
import { GET, POST } from './route';

vi.mock('@/lib/supabase/server', () => ({ serverSupabase: vi.fn() }));
const id = '00000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ id }) };
const root = `http://localhost:3000/api/games/${id}/spectators`;
const get = () => new Request(root);
const post = (body: unknown, headers: Record<string, string> = {}) => new Request(root, {
  method: 'POST', headers: {
    origin: 'http://localhost:3000', 'Content-Type': 'application/json',
    'X-Rookline-Account': id, ...headers,
  }, body: JSON.stringify(body),
});

function session(payload: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: payload, error });
  vi.mocked(serverSupabase).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc,
  } as never);
  return rpc;
}

describe('spectator consent API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an authenticated Supabase session', async () => {
    vi.mocked(serverSupabase).mockResolvedValue(null);
    expect((await GET(get(), params)).status).toBe(503);
    expect((await POST(post({ enabled: true }), params)).status).toBe(503);
    vi.mocked(serverSupabase).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);
    expect((await GET(get(), params)).status).toBe(401);
  });

  it('returns indistinguishable 404 for nonexistent, private or revoked games', async () => {
    const rpc = session(null);
    const response = await GET(get(), params);
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('rookline_spectator_snapshot', { p_game: id });
  });

  it('does not widen privacy when the database procedure fails', async () => {
    session(null, { message: 'insufficient_privilege' });
    const response = await GET(get(), params);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('insufficient_privilege');
  });

  it('returns the narrow snapshot supplied by the authenticated database RPC', async () => {
    const data = { role: 'spectator', game: { id, fen: 'canonical' }, serverNow: 1234 };
    session(data);
    const response = await GET(get(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
  });

  it('rejects cross-origin requests and stale account headers before consent RPC', async () => {
    const rpc = session(null);
    expect((await POST(post({ enabled: true }, { origin: 'https://attacker.example' }), params)).status).toBe(403);
    expect((await POST(post({ enabled: true }, { 'X-Rookline-Account': 'old-user' }), params)).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires exactly one boolean field and a bounded body', async () => {
    const rpc = session(null);
    expect((await POST(post({ enabled: 'yes' }), params)).status).toBe(422);
    expect((await POST(post({ enabled: true, userId: id }), params)).status).toBe(422);
    expect((await POST(post({ enabled: true, filler: 'x'.repeat(256) }), params)).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes caller identity only through verified auth.uid and supports revocation', async () => {
    const state = { role: 'player', enabled: false, otherEnabled: true, open: false };
    const rpc = session(state);
    const response = await POST(post({ enabled: false }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(state);
    expect(rpc).toHaveBeenCalledWith('rookline_spectator_consent', { p_game: id, p_enabled: false });
  });

  it('does not reveal the existence of non-player games via consent errors', async () => {
    session(null, { message: 'spectator_unavailable' });
    const response = await POST(post({ enabled: true }), params);
    expect(response.status).toBe(404);
  });
});
