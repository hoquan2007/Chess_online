import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { rejectCrossOrigin } from "@/lib/online/request-origin";
import { readLimitedJson } from "@/lib/online/request-json";
import { parseAccountPreferences } from "@/lib/profile/preferences";

export const dynamic = "force-dynamic";

function privateResponse(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function signedInClient() {
  const client = await serverSupabase();
  if (!client) return { client: null, userId: null, status: 503 } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, userId: null, status: 401 } as const;
  return { client, userId: user.id, status: 200 } as const;
}

export async function GET() {
  const context = await signedInClient();
  if (!context.client) return privateResponse({ error: "Account preferences unavailable" }, context.status);
  const { data, error } = await context.client.from("preferences")
    .select("theme,sounds_enabled").eq("user_id", context.userId).maybeSingle();
  if (error) return privateResponse({ error: "Unable to load preferences" }, 503);
  return privateResponse({ preferences: data }, 200);
}

export async function PATCH(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const context = await signedInClient();
  if (!context.client) return privateResponse({ error: "Account preferences unavailable" }, context.status);
  // Bind a queued browser write to the identity that created it. A sign-out or
  // account switch must never apply the old tab's payload to a new session.
  if (request.headers.get("X-Rookline-Account") !== context.userId) {
    return privateResponse({ error: "Account session changed; reload preferences" }, 409);
  }
  const body = await readLimitedJson(request, 256);
  if (!body.ok) return privateResponse({ error: body.error }, body.status);
  const validated = parseAccountPreferences(body.data);
  if (!validated.ok) return privateResponse({ error: validated.error }, 422);

  // Both the JWT-scoped client and preferences_own RLS constrain ownership.
  const { data, error } = await context.client.from("preferences")
    .upsert({ user_id: context.userId, ...validated.value }, { onConflict: "user_id" })
    .select("theme,sounds_enabled").single();
  if (error || !data) return privateResponse({ error: "Unable to save preferences" }, 503);
  return privateResponse({ preferences: data }, 200);
}
