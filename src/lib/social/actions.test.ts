import { describe, expect, it } from 'vitest';
import { parseSocialWrite } from './actions';

const id = '10000000-0000-4000-8000-000000000001';
describe('social request validation', () => {
  it('accepts only explicit supported operations', () => {
    expect(parseSocialWrite({ action: 'request', username: 'rook_player' })).toEqual({ action: 'request', username: 'rook_player' });
    expect(parseSocialWrite({ action: 'block', username: 'rook_player' })).toEqual({ action: 'block', username: 'rook_player' });
    expect(parseSocialWrite({ action: 'accept', targetId: id })).toEqual({ action: 'accept', targetId: id });
    expect(parseSocialWrite({ action: 'mark_read' })).toEqual({ action: 'mark_read' });
  });
  it('rejects spoofed actors, unexpected keys and malformed targets', () => {
    expect(parseSocialWrite({ action: 'accept', targetId: id, actorId: id })).toBeNull();
    expect(parseSocialWrite({ action: 'request', username: 'player!', requested_by: id })).toBeNull();
    expect(parseSocialWrite({ action: 'request', username: 'RookPlayer' })).toBeNull();
    expect(parseSocialWrite({ action: 'mark_read', recipient_id: id })).toBeNull();
    expect(parseSocialWrite({ action: 'remove', targetId: 'bad' })).toBeNull();
    expect(parseSocialWrite({ action: 'send_message', targetId: id })).toBeNull();
    expect(parseSocialWrite(null)).toBeNull();
  });
});
