import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

export function privateResponse(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function communitySession() {
  const client = await serverSupabase();
  if (!client) return { client: null, id: null, status: 503 } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, id: null, status: 401 } as const;
  return { client, id: user.id, status: 200 } as const;
}
