import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/online/request-origin';
import { readLimitedJson } from '@/lib/online/request-json';
import { communitySession, privateResponse } from '@/lib/social/http';
import { isChatId, parsePrivateChatWrite } from '@/lib/social/messages';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to read private messages' }, session.status);
  const url = new URL(request.url);
  const peer = url.searchParams.get('peer');
  if (url.searchParams.size !== 1 || !isChatId(peer) || peer === session.id) {
    return privateResponse({ error: 'Invalid conversation' }, 422);
  }
  const { data, error } = await session.client.from('private_messages')
    .select('id,sender_id,recipient_id,body,created_at')
    .in('sender_id', [session.id, peer])
    .in('recipient_id', [session.id, peer])
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (error) return privateResponse({ error: 'Unable to load messages' }, 503);
  return privateResponse({ accountId: session.id, peerId: peer, messages: (data ?? []).reverse() }, 200);
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to send private messages' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload messages' }, 409);
  }
  const body = await readLimitedJson(request, 3100);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const parsed = parsePrivateChatWrite(body.data);
  if (!parsed || parsed.recipientId === session.id) return privateResponse({ error: 'Invalid private message' }, 422);
  const { data, error } = await session.client.rpc('rookline_private_chat_send', {
    p_recipient: parsed.recipientId, p_body: parsed.body, p_nonce: parsed.nonce,
  });
  if (error) {
    if (error.message.includes('private_message_rate_limited')) {
      return privateResponse({ error: 'Too many messages; retry shortly' }, 429);
    }
    if (error.message.includes('private_chat_unavailable') || error.message.includes('private_message_nonce_conflict')) {
      return privateResponse({ error: 'Conversation unavailable; refresh and retry' }, 409);
    }
    return privateResponse({ error: 'Unable to send message' }, 503);
  }
  return NextResponse.json({ id: data }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
}
