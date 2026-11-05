import { beforeEach, describe, expect, it, vi } from 'vitest';

const alice = '10000000-0000-4000-8000-000000000001';
const bob = '20000000-0000-4000-8000-000000000002';
const getUser = vi.fn();
const serverSupabase = vi.fn();
const rpc = vi.fn();
const queries = vi.fn();
const queryResult = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({ serverSupabase: () => serverSupabase() }));
import { GET, POST } from './route';

function write(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://rookline.example/api/social', {
    method: 'POST', body: JSON.stringify(body),
    headers: { host: 'rookline.example', origin: 'https://rookline.example',
      'Content-Type': 'application/json', 'X-Rookline-Account': alice, ...headers },
  });
}

describe('account-bound social HTTP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      or: vi.fn(() => chain), eq: vi.fn(() => chain),
      order: vi.fn(() => chain), in: vi.fn(() => chain),
      limit: vi.fn(() => queryResult()), maybeSingle: () => maybeSingle(),
    };
    const from = vi.fn((table: string) => {
      queries(table);
      return { select: vi.fn(() => chain) };
    });
    getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null });
    serverSupabase.mockResolvedValue({ auth: { getUser }, from, rpc });
    queryResult.mockResolvedValue({ data: [], error: null });
    maybeSingle.mockResolvedValue({ data: { id: bob }, error: null });
    rpc.mockResolvedValue({ data: 'requested', error: null });
  });

  it('reads only signed-in social resources with private cache controls', async () => {
    const result = await GET();
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toEqual({ accountId: alice, profiles: [], connections: [], blocks: [], notifications: [] });
    expect(queries.mock.calls.map(([table]) => table)).toEqual(['friendships', 'user_blocks', 'social_notifications']);
  });

  it('resolves a username then passes only action and target to the JWT-scoped RPC', async () => {
    const result = await POST(write({ action: 'request', username: 'bob_123' }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: 'requested' });
    expect(queries).toHaveBeenCalledWith('profiles');
    expect(rpc).toHaveBeenCalledWith('rookline_social_action', { p_action: 'request', p_target: bob });
  });

  it('marks only the authenticated recipient notification inbox', async () => {
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    const result = await POST(write({ action: 'mark_read' }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ updated: 3 });
    expect(rpc).toHaveBeenCalledWith('rookline_social_mark_read');
  });

  it('denies forged origin before any server authentication', async () => {
    expect((await POST(write({ action: 'request', username: 'bob_123' }, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('denies stale accounts, spoofed actors and unexpected fields', async () => {
    expect((await POST(write({ action: 'accept', targetId: bob }, { 'X-Rookline-Account': bob }))).status).toBe(409);
    expect((await POST(write({ action: 'request', username: 'bob_123', actorId: bob }))).status).toBe(422);
    expect((await POST(write({ action: 'accept', targetId: alice }))).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects oversized input before issuing an RPC', async () => {
    expect((await POST(write({ action: 'request', username: 'bob_123', padding: 'x'.repeat(300) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed without configuration or a signed-in account', async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write({ action: 'mark_read' }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns non-sensitive errors and a rate-limit status', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'friend_request_rate_limited' } });
    expect((await POST(write({ action: 'request', username: 'bob_123' }))).status).toBe(429);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'private database details' } });
    const failed = await POST(write({ action: 'accept', targetId: bob }));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: 'Unable to update social connection' });
  });
});
