import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { rejectCrossOrigin } from "@/lib/online/request-origin";
import { readLimitedJson } from "@/lib/online/request-json";
import { knownLearningIds, parseLearningWrite, type LearningKind } from "@/lib/chess/learning-progress";

export const dynamic = "force-dynamic";

const privateResponse = (body: object, status: number) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

async function account() {
  const client = await serverSupabase();
  if (!client) return { client: null, userId: null, status: 503 } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, userId: null, status: 401 } as const;
  return { client, userId: user.id, status: 200 } as const;
}

export async function GET(request: Request) {
  const context = await account();
  if (!context.client) return privateResponse({ error: "Learning sync unavailable" }, context.status);
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "puzzle" && kind !== "study") return privateResponse({ error: "Invalid learning category" }, 422);
  const { data, error } = await context.client.from("learning_progress").select("item_id")
    .eq("user_id", context.userId).eq("kind", kind).limit(64);
  if (error) return privateResponse({ error: "Unable to load learning progress" }, 503);
  return privateResponse({ accountId: context.userId, ids: knownLearningIds(kind as LearningKind, (data ?? []).map((row) => row.item_id)) }, 200);
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const context = await account();
  if (!context.client) return privateResponse({ error: "Learning sync unavailable" }, context.status);
  if (request.headers.get("X-Rookline-Account") !== context.userId) {
    return privateResponse({ error: "Account session changed" }, 409);
  }
  const payload = await readLimitedJson(request, 4096);
  if (!payload.ok) return privateResponse({ error: payload.error }, payload.status);
  const parsed = parseLearningWrite(payload.data);
  if (!parsed.ok) return privateResponse({ error: "Invalid learning progress" }, 422);
  const { error } = await context.client.from("learning_progress").upsert(
    parsed.ids.map((id) => ({ user_id: context.userId, kind: parsed.kind, item_id: id })),
    { onConflict: "user_id,kind,item_id", ignoreDuplicates: true },
  );
  if (error) return privateResponse({ error: "Unable to save learning progress" }, 503);
  return privateResponse({ saved: parsed.ids.length }, 200);
}
