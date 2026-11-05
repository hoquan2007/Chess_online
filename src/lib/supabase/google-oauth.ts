import { safeNext } from "@/lib/online/redirect";

/** Supabase returns a PKCE code here after the Google provider redirects back. */
export function googleOAuthCallbackUrl(origin: string, next?: string): string {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeNext(next));
  callback.searchParams.set("provider", "google");
  return callback.toString();
}
