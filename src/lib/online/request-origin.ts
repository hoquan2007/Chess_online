import { NextResponse } from "next/server";

/** Reject cross-origin browser mutations using cookie-authenticated sessions. */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (origin !== null && origin !== new URL(request.url).origin)) {
    return NextResponse.json({ error: "Cross-origin action denied" }, { status: 403 });
  }
  return null;
}
