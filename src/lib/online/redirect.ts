/** Keep post-auth redirects on this origin and out of protocol-relative URLs. */
export function safeNext(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value)
    ? value
    : "/play/online";
}
