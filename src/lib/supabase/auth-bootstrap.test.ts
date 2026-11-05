import { describe, expect, it, vi } from 'vitest';
import { createAuthBootstrap } from './auth-bootstrap';

describe('initial auth verification race', () => {
  it('does not restore a signed-out account from an outdated getUser response', () => {
    const activate = vi.fn();
    const auth = createAuthBootstrap(activate);
    auth.onEvent('INITIAL_SESSION', 'account-a');
    auth.onEvent('SIGNED_OUT', null);
    auth.onVerified('account-a');
    expect(activate.mock.calls).toEqual([['account-a'], [null]]);
  });

  it('does not overwrite a new sign-in with a stale verified account', () => {
    const activate = vi.fn();
    const auth = createAuthBootstrap(activate);
    auth.onEvent('INITIAL_SESSION', 'account-a');
    auth.onEvent('SIGNED_IN', 'account-b');
    auth.onVerified('account-a');
    expect(activate).toHaveBeenLastCalledWith('account-b');
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('lets verified identity supersede an old initial session', () => {
    const activate = vi.fn();
    const auth = createAuthBootstrap(activate);
    auth.onEvent('INITIAL_SESSION', 'account-a');
    auth.onVerified(null);
    auth.onEvent('INITIAL_SESSION', 'account-a');
    expect(activate.mock.calls).toEqual([['account-a'], [null]]);
  });

  it('suppresses late results after disposal and preserves later auth events', () => {
    const activate = vi.fn();
    const auth = createAuthBootstrap(activate);
    auth.onVerified('account-a');
    auth.onEvent('SIGNED_IN', 'account-b');
    auth.dispose();
    auth.onEvent('SIGNED_OUT', null);
    auth.onVerified(null);
    expect(activate.mock.calls).toEqual([['account-a'], ['account-b']]);
  });
});
