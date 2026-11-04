/** Reconcile the initial verified user lookup with Supabase auth events.
 * A delayed getUser() response must never undo a later sign-in or sign-out.
 */
export function createAuthBootstrap(activate: (identity: string | null) => void) {
  let disposed = false;
  let hasTransition = false;
  let hasVerified = false;

  return {
    onEvent(event: string, identity: string | null) {
      if (disposed) return;
      if (event === 'INITIAL_SESSION') {
        // The verified response wins if the cached initial session arrives later.
        if (hasVerified || hasTransition) return;
      } else {
        hasTransition = true;
      }
      activate(identity);
    },
    onVerified(identity: string | null) {
      if (disposed || hasTransition) return;
      hasVerified = true;
      activate(identity);
    },
    dispose() { disposed = true; },
  };
}
