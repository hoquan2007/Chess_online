import { NextResponse } from "next/server";

function matchesRequestOrigin(request: Request, origin: string): boolean {
  try {
    const actual = new URL(origin);
    const requestUrl = new URL(request.url);
    // Next.js can normalize request.url to localhost in development even when
    // the HTTP Host received from the browser is 127.0.0.1 (or a public host).
    // Browsers cannot set Host or Origin from JavaScript.
    const host = request.headers.get("host") ?? requestUrl.host;
    return actual.origin === origin && actual.protocol === requestUrl.protocol &&
      actual.host === host.toLowerCase();
  } catch {
    return false;
  }
}

/** Require evidence of same-origin intent before any cookie-authenticated mutation. */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Browser scripts cannot forge Origin or Sec-Fetch-Site. A missing Origin
  // is safe only with affirmative same-origin fetch metadata; otherwise older
  // browsers/proxies with missing headers could bypass the CSRF defense.
  if (fetchSite === "cross-site" ||
    (origin === null ? fetchSite !== "same-origin" : !matchesRequestOrigin(request, origin))) {
    return NextResponse.json({ error: "Cross-origin action denied" }, { status: 403 });
  }
  return null;
}
