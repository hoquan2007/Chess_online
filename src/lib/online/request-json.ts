/** Enforce a byte limit even when Content-Length is absent or dishonest. */
export async function readLimitedJson(request: Request, maxBytes: number): Promise<
  | { ok: true; data: unknown }
  | { ok: false; error: string; status: 400 | 413 }
> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) {
    return { ok: false, error: "Invalid Content-Length", status: 400 };
  }
  if (declared !== null && Number(declared) > maxBytes) {
    return { ok: false, error: "Request too large", status: 413 };
  }
  if (!request.body) return { ok: false, error: "Invalid JSON", status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteCount = 0;
  let source = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        void reader.cancel();
        return { ok: false, error: "Request too large", status: 413 };
      }
      source += decoder.decode(value, { stream: true });
    }
    source += decoder.decode();
    return { ok: true, data: JSON.parse(source) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON", status: 400 };
  } finally {
    reader.releaseLock();
  }
}
