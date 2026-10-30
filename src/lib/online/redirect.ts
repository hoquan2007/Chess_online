const FALLBACK = "/play/online";
const VALIDATION_ORIGIN = "https://rookline.invalid";

/** Keep login, sign-up and confirmation redirects on the current origin. */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") ||
    value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return FALLBACK;
  }

  // WHATWG URL parsing strips embedded tabs, LF and CR before resolving a URL.
  // Check the resolved origin too, so URL normalization cannot turn a path
  // into a protocol-relative navigation during an authentication redirect.
  try {
    const target = new URL(value, VALIDATION_ORIGIN);
    return target.origin === VALIDATION_ORIGIN ? value : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
