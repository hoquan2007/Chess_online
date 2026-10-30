export type ProfileEdit = { username: string; display_name: string };

/** Validate browser input before it reaches an authenticated profile UPDATE. */
export function parseProfileEdit(body: unknown): { ok: true; value: ProfileEdit } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid profile update" };
  const fields = Object.keys(body);
  if (fields.length !== 2 || fields.some((key) => key !== "username" && key !== "display_name")) {
    return { ok: false, error: "Only username and display name can be changed" };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.username !== "string" || typeof candidate.display_name !== "string") {
    return { ok: false, error: "Username and display name must be text" };
  }
  const username = candidate.username.trim().toLowerCase();
  const display_name = candidate.display_name.trim().normalize("NFC");
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return { ok: false, error: "Username must be 3–24 letters, numbers or underscores" };
  }
  if (!display_name || [...display_name].length > 80 ||
    /[\u0000-\u001F\u007F-\u009F\u061C\u200E-\u200F\u202A-\u202E\u2066-\u2069]/u.test(display_name)) {
    return { ok: false, error: "Display name must be 1–80 characters without control characters" };
  }
  return { ok: true, value: { username, display_name } };
}
