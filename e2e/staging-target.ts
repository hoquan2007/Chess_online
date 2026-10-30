const localOrigin = "http://127.0.0.1:3100";

/** Resolve only an explicit staging web origin; reject accidental off-origin paths and insecure remote HTTP. */
export function resolveStagingAppOrigin(value: string | undefined): string {
  if (value === undefined) return localOrigin;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("ROOKLINE_STAGING_APP_ORIGIN must be a valid absolute web origin.");
  }
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (value !== parsed.origin || (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:"))) {
    throw new Error("ROOKLINE_STAGING_APP_ORIGIN must be a bare HTTPS origin (HTTP is allowed only on loopback).");
  }
  return parsed.origin;
}
