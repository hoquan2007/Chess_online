"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { safeNext } from "@/lib/online/redirect";

/** Complete older email links that return tokens in a browser-only URL fragment. */
export function AuthCompletion({ next }: { next: string }) {
  const [failed, setFailed] = useState(false);
  const destination = safeNext(next);

  useEffect(() => {
    let active = true;
    async function complete() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const client = browserSupabase();
      // Do not leave bearer credentials or provider errors in browser history.
      const clearFragment = () => window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!client || fragment.has("error")) {
        clearFragment();
        if (active) setFailed(true);
        return;
      }
      try {
        // The SSR browser client may already have consumed the fragment.
        // If another account was previously signed in, honor the new link's
        // tokens rather than redirecting with that unrelated account.
        const { data: { session } } = await client.auth.getSession();
        if (accessToken && refreshToken && session?.access_token !== accessToken) {
          const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        const { data: { user }, error } = await client.auth.getUser();
        clearFragment();
        if (error || !user) throw error ?? new Error("Confirmation did not create a valid session.");
        if (active) window.location.replace(destination);
      } catch {
        clearFragment();
        if (active) setFailed(true);
      }
    }
    void complete();
    return () => { active = false; };
  }, [destination]);

  return <div className="text-panel stack" style={{ maxWidth: 560 }}>
    <p className="overline">Rookline account</p>
    <h1 className="page-title">{failed ? "Could not confirm your email." : "Confirming your account…"}</h1>
    <p className="muted" role="status">{failed
      ? "The confirmation link may have expired or already been used. Sign in or request a new verification email."
      : "Checking your confirmation and signing you in securely."}</p>
    {failed && <Link className="btn primary" href={`/login?error=confirmation&next=${encodeURIComponent(destination)}`}>Return to sign in</Link>}
  </div>;
}
