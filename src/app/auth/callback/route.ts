import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/online/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const googleProvider = url.searchParams.get("provider") === "google";
  const destination = safeNext(url.searchParams.get("next"));
  // A legacy/implicit confirmation can return credentials in the URL fragment.
  // Fragments never reach the server; let the browser finish that flow safely.
  if (!code && !tokenHash && !url.searchParams.has("error") && !googleProvider) {
    const completion = new URL("/auth/complete", url.origin);
    completion.searchParams.set("next", destination);
    return NextResponse.redirect(completion);
  }
  const client = await serverSupabase();
  if (client) {
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(destination, url.origin));
    } else if (tokenHash && (type === "email" || type === "invite" || type === "magiclink" || type === "recovery")) {
      // Supabase templates can use {{ .TokenHash }} links instead of a PKCE code.
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(destination, url.origin));
    }
  }
  const login = new URL("/login", url.origin);
  login.searchParams.set("error", googleProvider ? "google" : "confirmation");
  login.searchParams.set("next", destination);
  return NextResponse.redirect(login);
}
