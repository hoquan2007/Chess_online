import { beforeEach, describe, expect, it, vi } from 'vitest';

const alice = '10000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const getUser = vi.fn();
const serverSupabase = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ serverSupabase: () => serverSupabase() }));
import { GET, POST } from './route';

function write(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://rookline.example/api/moderation', {
    method: 'POST', body: JSON.stringify(body), headers: {
      host: 'rookline.example', origin: 'https://rookline.example',
      'Content-Type': 'application/json', 'X-Rookline-Account': alice, ...headers,
    },
  });
}

describe('S5 moderation API privilege boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null });
    serverSupabase.mockResolvedValue({ auth: { getUser }, rpc });
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it('reads the private queue through a server RPC that enforces moderator membership', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ accountId: alice, reports: [] });
    expect(rpc).toHaveBeenCalledWith('rookline_moderation_queue');
  });

  it('allows only a bounded report ID and decision to reach the database RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'resolved', error: null });
    const response = await POST(write({ reportId: 12, decision: 'resolved' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'resolved' });
    expect(rpc).toHaveBeenCalledWith('rookline_moderate_report', { p_report: 12, p_decision: 'resolved' });
  });

  it('rejects CSRF before authentication and changed account sessions', async () => {
    expect((await POST(write({ reportId: 12, decision: 'dismissed' }, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect((await POST(write({ reportId: 12, decision: 'dismissed' }, { 'X-Rookline-Account': other }))).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects extra actor fields, invalid decisions and excessive payloads', async () => {
    expect((await POST(write({ reportId: 12, decision: 'resolved', moderatorId: alice }))).status).toBe(422);
    expect((await POST(write({ reportId: 12, decision: 'ban' }))).status).toBe(422);
    expect((await POST(write({ reportId: -1, decision: 'resolved' }))).status).toBe(422);
    expect((await POST(write({ reportId: 12, decision: 'dismissed', padding: 'x'.repeat(200) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase or authenticated user is absent', async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write({ reportId: 12, decision: 'resolved' }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('denies non-staff and maps duplicate reviews without leaking SQL details', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'moderator_required' } });
    expect((await GET()).status).toBe(403);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'report_already_reviewed' } });
    expect((await POST(write({ reportId: 12, decision: 'resolved' }))).status).toBe(409);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'sensitive statement' } });
    const response = await POST(write({ reportId: 12, decision: 'dismissed' }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('sensitive statement');
    rpc.mockResolvedValueOnce({ data: { invalid: true }, error: null });
    expect((await GET()).status).toBe(503);
  });
});
