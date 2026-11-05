import { describe, expect, it } from 'vitest';
import { isChatId, parsePrivateChatWrite, preparePrivateChatRetry } from './messages';

const recipientId = '20000000-0000-4000-8000-000000000002';
const nonce = '10000000-0000-4000-8000-000000000001';

describe('private conversation request validation', () => {
  it('accepts a bounded, exact send request and international text', () => {
    expect(parsePrivateChatWrite({ recipientId, nonce, body: 'Hello, bạn khỏe không? ♟️' }))
      .toEqual({ recipientId, nonce, body: 'Hello, bạn khỏe không? ♟️' });
    expect(isChatId(recipientId)).toBe(true);
    expect(isChatId('not-a-uuid')).toBe(false);
  });

  it('rejects spoofed sender fields, whitespace, oversize and invalid keys', () => {
    const valid = { recipientId, nonce, body: 'hello' };
    expect(parsePrivateChatWrite({ ...valid, senderId: nonce })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, created_at: '2026-11-04' })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, body: ' hello ' })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, body: '' })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, body: 'x'.repeat(501) })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, nonce: 'replay' })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, recipientId: 'someone' })).toBeNull();
    expect(parsePrivateChatWrite({ ...valid, body: '♟'.repeat(500) })).not.toBeNull();
    expect(parsePrivateChatWrite({ ...valid, body: '🎉'.repeat(500) })).toBeNull();
    expect(parsePrivateChatWrite(null)).toBeNull();
  });
});

describe('private conversation retries', () => {
  it('reuses the same nonce after a lost response for exactly the same message', () => {
    let generated = 0;
    const generate = () => { generated++; return nonce; };
    const initial = preparePrivateChatRetry(null, recipientId, 'hello', generate);
    const replay = preparePrivateChatRetry(initial, recipientId, 'hello', generate);
    expect(replay).toBe(initial);
    expect(generated).toBe(1);
  });

  it('creates a fresh nonce when text or recipient changes', () => {
    let generated = 0;
    const generate = () => `nonce-${++generated}`;
    const initial = preparePrivateChatRetry(null, recipientId, 'hello', generate);
    const revised = preparePrivateChatRetry(initial, recipientId, 'hello again', generate);
    const other = preparePrivateChatRetry(revised, '30000000-0000-4000-8000-000000000003', 'hello again', generate);
    expect([initial.nonce, revised.nonce, other.nonce]).toEqual(['nonce-1', 'nonce-2', 'nonce-3']);
  });
});
