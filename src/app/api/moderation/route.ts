import { rejectCrossOrigin } from '@/lib/online/request-origin';
import { readLimitedJson } from '@/lib/online/request-json';
import { parseModerationWrite } from '@/lib/social/community';
import { communitySession, privateResponse } from '@/lib/social/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Moderator access unavailable' }, session.status);
  const { data, error } = await session.client.rpc('rookline_moderation_queue');
  if (error) return privateResponse({ error: error.message.includes('moderator_required') ? 'Moderator access required' : 'Unable to load moderation queue' },
    error.message.includes('moderator_required') ? 403 : 503);
  if (!Array.isArray(data)) return privateResponse({ error: 'Unable to load moderation queue' }, 503);
  return privateResponse({ accountId: session.id, reports: data }, 200);
}

export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const session = await communitySession();
  if (!session.client) return privateResponse({ error: 'Moderator access unavailable' }, session.status);
  if (request.headers.get('X-Rookline-Account') !== session.id) {
    return privateResponse({ error: 'Account changed; reload queue' }, 409);
  }
  const body = await readLimitedJson(request, 128);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const action = parseModerationWrite(body.data);
  if (!action) return privateResponse({ error: 'Invalid review decision' }, 422);
  const { data, error } = await session.client.rpc('rookline_moderate_report', {
    p_report: action.reportId, p_decision: action.decision,
  });
  if (error) {
    if (error.message.includes('moderator_required')) return privateResponse({ error: 'Moderator access required' }, 403);
    if (error.message.includes('report_already_reviewed')) return privateResponse({ error: 'Report already reviewed' }, 409);
    return privateResponse({ error: 'Unable to review report' }, 503);
  }
  return privateResponse({ status: data }, 200);
}
