import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { rejectCrossOrigin } from '@/lib/online/request-origin';
import { readLimitedJson } from '@/lib/online/request-json';
import { parseSocialWrite } from '@/lib/social/actions';

export const dynamic = 'force-dynamic';
const privateResponse = (body: object, status: number) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

async function account() {
  const client = await serverSupabase();
  if (!client) return { client: null, id: null, status: 503 } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, id: null, status: 401 } as const;
  return { client, id: user.id, status: 200 } as const;
}

export async function GET() {
  const session = await account();
  if (!session.client) return privateResponse({ error: 'Social features require sign-in and a configured service' }, session.status);
  const client = session.client;
  const [friends, blocks, notifications] = await Promise.all([
    client.from('friendships').select('user_low,user_high,requested_by,status,created_at')
      .or(`user_low.eq.${session.id},user_high.eq.${session.id}`).limit(200),
    client.from('user_blocks').select('blocked_id,created_at').eq('blocker_id', session.id).limit(200),
    client.from('social_notifications').select('id,actor_id,kind,created_at,read_at')
      .eq('recipient_id', session.id).order('created_at', { ascending: false }).limit(40),
  ]);
  if (friends.error || blocks.error || notifications.error) {
    return privateResponse({ error: 'Unable to load social activity' }, 503);
  }
  const ids = new Set<string>();
  for (const row of friends.data ?? []) ids.add(row.user_low === session.id ? row.user_high : row.user_low);
  for (const row of blocks.data ?? []) ids.add(row.blocked_id);
  for (const row of notifications.data ?? []) ids.add(row.actor_id);
  const lookup = ids.size ? await client.from('profiles').select('id,username,display_name').in('id', [...ids]) : null;
  if (lookup?.error) return privateResponse({ error: 'Unable to load player names' }, 503);
  return privateResponse({
    accountId: session.id,
    profiles: lookup?.data ?? [],
    connections: friends.data ?? [],
    blocks: blocks.data ?? [],
    notifications: notifications.data ?? [],
  }, 200);
}

export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const session = await account();
  if (!session.client) return privateResponse({ error: 'Sign in to manage social connections' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload social activity' }, 409);
  }
  const body = await readLimitedJson(request, 256);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const parsed = parseSocialWrite(body.data);
  if (!parsed) return privateResponse({ error: 'Invalid social action' }, 422);
  if (parsed.action === 'mark_read') {
    const { data, error } = await session.client.rpc('rookline_social_mark_read');
    if (error) return privateResponse({ error: 'Unable to update notifications' }, 503);
    return privateResponse({ updated: data }, 200);
  }
  let targetId: string;
  if ('username' in parsed) {
    const { data, error } = await session.client.from('profiles').select('id').eq('username', parsed.username).maybeSingle();
    if (error) return privateResponse({ error: 'Unable to find player' }, 503);
    if (!data) return privateResponse({ error: 'Player not found' }, 404);
    targetId = data.id;
  } else {
    targetId = parsed.targetId;
  }
  if (targetId === session.id) return privateResponse({ error: 'Cannot manage your own account' }, 422);
  const { data, error } = await session.client.rpc('rookline_social_action', { p_action: parsed.action, p_target: targetId });
  if (error) {
    if (error.message.includes('friend_request_rate_limited')) return privateResponse({ error: 'Request limit reached; retry tomorrow' }, 429);
    if (error.message.includes('friend_request_unavailable') || error.message.includes('social_connection_unavailable')) {
      return privateResponse({ error: 'Connection unavailable; refresh and retry' }, 409);
    }
    return privateResponse({ error: 'Unable to update social connection' }, 503);
  }
  return privateResponse({ status: data }, 200);
}
