export type AccountPreferences = { theme: "dark" | "light"; sounds_enabled: boolean };

/** Explicitly reject privileged fields and invalid values. */
export function parseAccountPreferences(body: unknown):
  | { ok: true; value: AccountPreferences }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid preferences" };
  }
  const fields = Object.keys(body);
  if (fields.length !== 2 || fields.some((key) => key !== "theme" && key !== "sounds_enabled")) {
    return { ok: false, error: "Only theme and move sounds can be changed" };
  }
  const value = body as Record<string, unknown>;
  if ((value.theme !== "dark" && value.theme !== "light") || typeof value.sounds_enabled !== "boolean") {
    return { ok: false, error: "Invalid theme or move sounds setting" };
  }
  return { ok: true, value: { theme: value.theme, sounds_enabled: value.sounds_enabled } };
}
