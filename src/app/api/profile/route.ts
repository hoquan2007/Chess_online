import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { rejectCrossOrigin } from "@/lib/online/request-origin";
import { readLimitedJson } from "@/lib/online/request-json";
import { parseProfileEdit } from "@/lib/profile/edit";

export const dynamic = "force-dynamic";

function privateResponse(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const client = await serverSupabase();
  if (!client) return privateResponse({ error: "Profiles are unavailable" }, 503);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return privateResponse({ error: "Sign in to edit your profile" }, 401);

  const parsed = await readLimitedJson(request, 512);
  if (!parsed.ok) return privateResponse({ error: parsed.error }, parsed.status);
  const edit = parseProfileEdit(parsed.data);
  if (!edit.ok) return privateResponse({ error: edit.error }, 422);

  // The user-scoped Supabase client also enforces the profiles_update RLS policy.
  const { data, error } = await client.from("profiles").update(edit.value).eq("id", user.id)
    .select("username,display_name").maybeSingle();
  if (error?.code === "23505") return privateResponse({ error: "This username is already taken" }, 409);
  if (error) return privateResponse({ error: "Unable to save your profile" }, 503);
  if (!data) return privateResponse({ error: "Profile not found" }, 404);
  return privateResponse({ profile: data }, 200);
}
