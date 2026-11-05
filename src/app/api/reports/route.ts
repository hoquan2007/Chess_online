import { rejectCrossOrigin } from '@/lib/online/request-origin';
import { readLimitedJson } from '@/lib/online/request-json';
import { parseReportWrite } from '@/lib/social/community';
import { communitySession, privateResponse } from '@/lib/social/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Reports unavailable' }, session.status);
  const { data, error } = await session.client.from('player_reports')
    .select('id,category,status,created_at').eq('reporter_id', session.id)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return privateResponse({ error: 'Unable to load reports' }, 503);
  return privateResponse({ accountId: session.id, reports: data ?? [] }, 200);
}

export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Sign in to report a player' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload reports' }, 409);
  }
  const body = await readLimitedJson(request, 1024);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const report = parseReportWrite(body.data);
  if (!report) return privateResponse({ error: 'Invalid report details' }, 422);
  const { data: target, error: lookupError } = await session.client.from('profiles')
    .select('id').eq('username', report.username).maybeSingle();
  if (lookupError) return privateResponse({ error: 'Unable to find player' }, 503);
  if (!target) return privateResponse({ error: 'Player not found' }, 404);
  if (target.id === session.id) return privateResponse({ error: 'You cannot report yourself' }, 422);
  const { data, error } = await session.client.rpc('rookline_report_player', {
    p_target: target.id, p_category: report.category, p_details: report.details,
  });
  if (error) {
    if (error.message.includes('report_rate_limited')) return privateResponse({ error: 'Daily report limit reached' }, 429);
    if (error.message.includes('report_duplicate')) return privateResponse({ error: 'You already submitted this report today' }, 409);
    return privateResponse({ error: 'Unable to submit report' }, 503);
  }
  return privateResponse({ reportId: data, status: 'pending' }, 200);
}
