const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const username = /^[a-z0-9_]{3,24}$/;
const categories = ['harassment', 'spam', 'cheating', 'other'] as const;

export type TournamentWrite =
  | { action: 'create'; title: string; description: string; startsAt: string; capacity: number }
  | { action: 'join' | 'leave' | 'cancel'; tournamentId: string };

export type ReportWrite = { username: string; category: (typeof categories)[number]; details: string };
export type ModerationWrite = { reportId: number; decision: 'resolved' | 'dismissed' };

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function exactly(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function parseTournamentWrite(value: unknown): TournamentWrite | null {
  const data = recordOf(value);
  if (!data) return null;
  if (data.action === 'create' && exactly(data, ['action', 'title', 'description', 'startsAt', 'capacity'])) {
    if (typeof data.title !== 'string' || data.title !== data.title.trim() || data.title.length < 4 || data.title.length > 80 ||
        typeof data.description !== 'string' || data.description.length > 400 ||
        typeof data.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.startsAt) ||
        !Number.isFinite(Date.parse(data.startsAt)) ||
        new Date(data.startsAt).toISOString().slice(0, 19) !== data.startsAt.slice(0, 19) ||
        !Number.isInteger(data.capacity) ||
        (data.capacity as number) < 4 || (data.capacity as number) > 64) return null;
    return { action: 'create', title: data.title, description: data.description, startsAt: data.startsAt, capacity: data.capacity as number };
  }
  if (['join','leave','cancel'].includes(String(data.action)) && exactly(data, ['action', 'tournamentId']) &&
      typeof data.tournamentId === 'string' && uuid.test(data.tournamentId)) {
    return { action: data.action as 'join' | 'leave' | 'cancel', tournamentId: data.tournamentId };
  }
  return null;
}

export function parseReportWrite(value: unknown): ReportWrite | null {
  const data = recordOf(value);
  if (!data || !exactly(data, ['username', 'category', 'details']) ||
      typeof data.username !== 'string' || !username.test(data.username) ||
      typeof data.category !== 'string' || !categories.some((category) => category === data.category) ||
      typeof data.details !== 'string' || data.details.trim().length < 20 || data.details.trim().length > 500) return null;
  return { username: data.username, category: data.category as ReportWrite['category'], details: data.details.trim() };
}

export function parseModerationWrite(value: unknown): ModerationWrite | null {
  const data = recordOf(value);
  if (!data || !exactly(data, ['reportId', 'decision']) ||
      !Number.isSafeInteger(data.reportId) || (data.reportId as number) < 1 ||
      (data.decision !== 'resolved' && data.decision !== 'dismissed')) return null;
  return { reportId: data.reportId as number, decision: data.decision };
}
