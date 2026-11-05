export type PrivateChatWrite = { recipientId: string; body: string; nonce: string };

// Retain the caller's idempotency key when an HTTP response is lost and the
// exact same message is sent again. New content or peers need a new nonce.
export function preparePrivateChatRetry(
  pending: PrivateChatWrite | null,
  recipientId: string,
  body: string,
  createNonce: () => string,
): PrivateChatWrite {
  if (pending?.recipientId === recipientId && pending.body === body) return pending;
  return { recipientId, body, nonce: createNonce() };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isChatId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}

export function parsePrivateChatWrite(value: unknown): PrivateChatWrite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'body,nonce,recipientId' ||
      !isChatId(record.recipientId) || !isChatId(record.nonce) ||
      typeof record.body !== 'string' || record.body.length < 1 || record.body.length > 500 ||
      record.body !== record.body.trim() ||
      new TextEncoder().encode(record.body).byteLength > 2000) return null;
  return { recipientId: record.recipientId, body: record.body, nonce: record.nonce };
}
