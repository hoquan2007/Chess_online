import { NextResponse } from 'next/server';
import { validUuid } from '@/lib/online/games';
import { communitySession, privateResponse } from '@/lib/social/http';
import { readLimitedJson } from '@/lib/online/request-json';
import { rejectCrossOrigin } from '@/lib/online/request-origin';

type Context = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!validUuid(id)) return privateResponse({ error: 'Invalid game ID' }, 400);
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to watch this game' }, session.status);
  const { data, error } = await session.client.rpc('rookline_spectator_snapshot', { p_game: id });
  if (error) return privateResponse({ error: 'Spectator service unavailable' }, 503);
  // Deliberately indistinguishable for nonexistent, private, rated and revoked games.
  if (!data) return privateResponse({ error: 'Game is not available to watch' }, 404);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request, { params }: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { id } = await params;
  if (!validUuid(id)) return privateResponse({ error: 'Invalid game ID' }, 400);
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to manage spectators' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload the game' }, 409);
  }
  const parsed = await readLimitedJson(request, 128);
  if (!parsed.ok) return privateResponse({ error: parsed.error }, parsed.status);
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data) ||
      Object.keys(parsed.data).length !== 1 ||
      typeof (parsed.data as Record<string, unknown>).enabled !== 'boolean') {
    return privateResponse({ error: 'Invalid spectator permission' }, 422);
  }
  const { data, error } = await session.client.rpc('rookline_spectator_consent', {
    p_game: id, p_enabled: (parsed.data as { enabled: boolean }).enabled,
  });
  if (error) {
    if (error.message.includes('spectator_unavailable')) {
      return privateResponse({ error: 'Spectator permission unavailable' }, 404);
    }
    return privateResponse({ error: 'Spectator service unavailable' }, 503);
  }
  return privateResponse(data, 200);
}
