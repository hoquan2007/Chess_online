import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function hasSupabaseConfig() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options);
        } catch { /* Read-only server render cannot update cookies; route handlers can. */ }
      },
    },
  });
}

export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedGameContext() {
  const client = await serverSupabase();
  const admin = adminSupabase();
  if (!client || !admin) return { user: null, admin: null, status: 503, error: "Chess service is not configured." } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { user: null, admin: null, status: 401, error: "Sign in to play online." } as const;
  return { user, admin, status: 200, error: null } as const;
}
