export type SocialWrite =
  | { action: 'mark_read' }
  | { action: 'request' | 'block'; username: string }
  | { action: 'accept' | 'decline' | 'remove' | 'block' | 'unblock'; targetId: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const username = /^[a-z0-9_]{3,24}$/;

export function parseSocialWrite(value: unknown): SocialWrite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(',');
  if (record.action === 'mark_read') return keys === 'action' ? { action: 'mark_read' } : null;
  if ((record.action === 'request' || record.action === 'block') && keys === 'action,username' &&
      typeof record.username === 'string' && username.test(record.username)) {
    return { action: record.action, username: record.username };
  }
  if (['accept','decline','remove','block','unblock'].includes(String(record.action)) &&
      keys === 'action,targetId' && typeof record.targetId === 'string' && uuid.test(record.targetId)) {
    return { action: record.action as 'accept' | 'decline' | 'remove' | 'block' | 'unblock', targetId: record.targetId };
  }
  return null;
}
