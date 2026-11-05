import { beforeEach, describe, expect, it, vi } from 'vitest';

const alice = '10000000-0000-4000-8000-000000000001';
const bob = '20000000-0000-4000-8000-000000000002';
const getUser = vi.fn();
const serverSupabase = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const maybeSingle = vi.fn();
const reportsResult = vi.fn();

vi.mock('@/lib/supabase/server', () => ({ serverSupabase: () => serverSupabase() }));
import { GET, POST } from './route';

const valid = { username: 'player_two', category: 'cheating', details: 'Suspicious moves throughout the entire match.' };

function write(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://rookline.example/api/reports', {
    method: 'POST', body: JSON.stringify(body), headers: {
      host: 'rookline.example', origin: 'https://rookline.example',
      'Content-Type': 'application/json', 'X-Rookline-Account': alice, ...headers,
    },
  });
}

describe('S5 private reporting API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      eq: vi.fn(() => chain), order: vi.fn(() => chain),
      limit: vi.fn(() => reportsResult()), maybeSingle: () => maybeSingle(),
    };
    from.mockImplementation(() => ({ select: () => chain }));
    getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null });
    serverSupabase.mockResolvedValue({ auth: { getUser }, from, rpc });
    reportsResult.mockResolvedValue({ data: [], error: null });
    maybeSingle.mockResolvedValue({ data: { id: bob }, error: null });
    rpc.mockResolvedValue({ data: 12, error: null });
  });

  it('loads only the signed-in reporter history as a private response', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ accountId: alice, reports: [] });
    expect(from).toHaveBeenCalledWith('player_reports');
  });

  it('resolves the target by username and lets database derive the reporter from JWT', async () => {
    const response = await POST(write(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reportId: 12, status: 'pending' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(rpc).toHaveBeenCalledWith('rookline_report_player', {
      p_target: bob, p_category: valid.category, p_details: valid.details,
    });
  });

  it('rejects foreign origin before authentication and a changed session account', async () => {
    expect((await POST(write(valid, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect(serverSupabase).not.toHaveBeenCalled();
    expect((await POST(write(valid, { 'X-Rookline-Account': bob }))).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects spoofed actors, invalid categories and large requests', async () => {
    expect((await POST(write({ ...valid, reporterId: bob }))).status).toBe(422);
    expect((await POST(write({ ...valid, category: 'admin' }))).status).toBe(422);
    expect((await POST(write({ ...valid, details: 'x'.repeat(1100) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects missing users and self-reporting', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(write(valid))).status).toBe(404);
    maybeSingle.mockResolvedValueOnce({ data: { id: alice }, error: null });
    expect((await POST(write(valid))).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed for unconfigured service, anonymous user and query errors', async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write(valid))).status).toBe(401);
    reportsResult.mockResolvedValueOnce({ data: null, error: { message: 'secret query' } });
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain('secret query');
  });

  it('maps duplicate/rate-limit errors and suppresses raw SQL failures', async () => {
    for (const [message, expected] of [
      ['report_duplicate', 409], ['report_rate_limited', 429], ['private database detail', 503],
    ] as const) {
      rpc.mockResolvedValueOnce({ data: null, error: { message } });
      const response = await POST(write(valid));
      expect(response.status).toBe(expected);
      expect(JSON.stringify(await response.json())).not.toContain(message);
    }
  });
});
