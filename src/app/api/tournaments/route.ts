import { rejectCrossOrigin } from '@/lib/online/request-origin';
import { readLimitedJson } from '@/lib/online/request-json';
import { parseTournamentWrite } from '@/lib/social/community';
import { communitySession, privateResponse } from '@/lib/social/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Tournament service unavailable' }, session.status);
  const { data, error } = await session.client.rpc('rookline_tournament_list');
  if (error || !Array.isArray(data)) return privateResponse({ error: 'Unable to load tournaments' }, 503);
  return privateResponse({ accountId: session.id, tournaments: data }, 200);
}

export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to join tournaments' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload tournaments' }, 409);
  }
  const body = await readLimitedJson(request, 1024);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const action = parseTournamentWrite(body.data);
  if (!action) return privateResponse({ error: 'Invalid tournament action' }, 422);
  const { data, error } = action.action === 'create'
    ? await session.client.rpc('rookline_tournament_create', {
        p_title: action.title, p_description: action.description,
        p_starts_at: action.startsAt, p_capacity: action.capacity,
      })
    : await session.client.rpc('rookline_tournament_action', {
        p_action: action.action, p_tournament: action.tournamentId,
      });
  if (error) {
    if (error.message.includes('tournament_rate_limited')) return privateResponse({ error: 'Tournament creation limit reached' }, 429);
    if (['tournament_closed', 'tournament_full', 'tournament_unavailable'].some((value) => error.message.includes(value))) {
      return privateResponse({ error: 'Tournament is no longer available for this action' }, 409);
    }
    if (error.message.includes('invalid_tournament')) return privateResponse({ error: 'Tournament must start in 1–90 days' }, 422);
    return privateResponse({ error: 'Unable to update tournament' }, 503);
  }
  return privateResponse(action.action === 'create' ? { tournamentId: data } : { status: data }, 200);
}
