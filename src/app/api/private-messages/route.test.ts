import { beforeEach, describe, expect, it, vi } from 'vitest';

const alice = '10000000-0000-4000-8000-000000000001';
const bob = '20000000-0000-4000-8000-000000000002';
const nonce = '30000000-0000-4000-8000-000000000003';
const getUser = vi.fn();
const serverSupabase = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const filters = vi.fn();
const queryResult = vi.fn();

vi.mock('@/lib/supabase/server', () => ({ serverSupabase: () => serverSupabase() }));
import { GET, POST } from './route';

const valid = { recipientId: bob, body: 'Hello friend', nonce };
function read(query = `peer=${bob}`) {
  return new Request(`https://rookline.example/api/private-messages?${query}`);
}
function write(body: unknown = valid, headers: Record<string, string> = {}) {
  return new Request('https://rookline.example/api/private-messages', {
    method: 'POST', body: JSON.stringify(body),
    headers: { host: 'rookline.example', origin: 'https://rookline.example',
      'Content-Type': 'application/json', 'X-Rookline-Account': alice, ...headers },
  });
}

describe('private chat HTTP permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { in: vi.fn((field: string, ids: string[]) => {
      filters(field, ids); return query;
    }), order: vi.fn(() => query), limit: vi.fn(() => queryResult()) };
    from.mockReturnValue({ select: vi.fn(() => query) });
    getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null });
    serverSupabase.mockResolvedValue({ auth: { getUser }, from, rpc });
    queryResult.mockResolvedValue({ data: [{ id: 1, body: 'Hello friend', sender_id: alice, recipient_id: bob }], error: null });
    rpc.mockResolvedValue({ data: 123, error: null });
  });

  it('scopes message reads to only the authenticated pair and private caching', async () => {
    const response = await GET(read());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(filters.mock.calls).toEqual([['sender_id', [alice, bob]], ['recipient_id', [alice, bob]]]);
    expect(await response.json()).toEqual({ accountId: alice, peerId: bob,
      messages: [{ id: 1, body: 'Hello friend', sender_id: alice, recipient_id: bob }] });
  });

  it('rejects malformed peers and hidden query selectors without hitting the table', async () => {
    expect((await GET(read('peer=bad'))).status).toBe(422);
    expect((await GET(read(`peer=${alice}`))).status).toBe(422);
    expect((await GET(read(`peer=${bob}&peer=${alice}`))).status).toBe(422);
    expect((await GET(read(''))).status).toBe(422);
    expect(from).not.toHaveBeenCalled();
  });

  it('sends only the recipient/body/nonce via an authenticated RPC', async () => {
    const response = await POST(write());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ id: 123 });
    expect(rpc).toHaveBeenCalledWith('rookline_private_chat_send', {
      p_recipient: bob, p_body: 'Hello friend', p_nonce: nonce,
    });
  });

  it('rejects CSRF, stale account and actor overrides without invoking the RPC', async () => {
    expect((await POST(write(valid, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await POST(write(valid, { 'X-Rookline-Account': bob }))).status).toBe(409);
    expect((await POST(write({ ...valid, senderId: alice }))).status).toBe(422);
    expect((await POST(write({ ...valid, recipientId: alice }))).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('caps request bytes and avoids leaking RPC errors', async () => {
    expect((await POST(write({ ...valid, body: 'x'.repeat(3200) }))).status).toBe(413);
    rpc.mockResolvedValueOnce({ error: { message: 'private_message_rate_limited' }, data: null });
    expect((await POST(write())).status).toBe(429);
    rpc.mockResolvedValueOnce({ error: { message: 'private_chat_unavailable' }, data: null });
    expect((await POST(write())).status).toBe(409);
    rpc.mockResolvedValueOnce({ error: { message: 'secret database details' }, data: null });
    const error = await POST(write());
    expect(error.status).toBe(503);
    expect(await error.json()).toEqual({ error: 'Unable to send message' });
  });

  it('fails closed on unavailable configuration, session or database reads', async () => {
    serverSupabase.mockResolvedValueOnce(null);
    expect((await GET(read())).status).toBe(503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(write())).status).toBe(401);
    queryResult.mockResolvedValueOnce({ data: null, error: { message: 'private' } });
    expect((await GET(read())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});
