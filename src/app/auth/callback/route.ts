import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/online/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = safeNext(url.searchParams.get("next"));
  const client = await serverSupabase();
  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
