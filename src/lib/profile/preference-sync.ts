import { parseAccountPreferences, type AccountPreferences } from "./preferences";

export type PreferenceSyncStatus = "local" | "loading" | "saving" | "saved" | "error";

/** Serialize account writes so rapid clicks cannot persist an older preference last. */
export function createPreferenceSync({ readLocal, applyRemote, onStatus, request }: {
  readLocal: () => AccountPreferences;
  applyRemote: (preferences: AccountPreferences) => void;
  onStatus: (status: PreferenceSyncStatus) => void;
  request: typeof fetch;
}) {
  let accountId: string | null = null;
  let generation = 0;
  let localRevision = 0;
  let savedRevision = 0;
  let ready = false;
  let writing = false;
  let loading = false;
  let disposed = false;
  let activeWrite: AbortController | null = null;

  async function flush() {
    if (writing || !ready || !accountId || disposed || savedRevision >= localRevision) return;
    writing = true;
    const currentGeneration = generation;
    let failed = false;
    try {
      while (!disposed && ready && accountId && currentGeneration === generation && savedRevision < localRevision) {
        const revision = localRevision;
        const controller = new AbortController();
        activeWrite = controller;
        onStatus("saving");
        const response = await request("/api/preferences", {
          method: "PATCH", headers: { "Content-Type": "application/json", "X-Rookline-Account": accountId },
          credentials: "same-origin", cache: "no-store", body: JSON.stringify(readLocal()), signal: controller.signal,
        });
        if (!response.ok) throw new Error("Preference write failed");
        if (currentGeneration !== generation || disposed) break;
        savedRevision = revision;
      }
      if (!disposed && currentGeneration === generation) onStatus("saved");
    } catch {
      failed = currentGeneration === generation;
      if (!disposed && currentGeneration === generation) onStatus("error");
    } finally {
      activeWrite = null;
      writing = false;
      // A new account can become ready while the prior account's write is in flight.
      if (!failed && !disposed && ready && savedRevision < localRevision) void flush();
    }
  }

  async function setAccount(nextAccountId: string | null, retry = false) {
    if (disposed || (nextAccountId === accountId && (!retry || loading))) return;
    if (nextAccountId !== accountId) activeWrite?.abort();
    accountId = nextAccountId;
    const currentGeneration = ++generation;
    ready = false;
    savedRevision = localRevision;
    if (!accountId) { onStatus("local"); return; }
    const revisionBeforeLoad = localRevision;
    loading = true;
    onStatus("loading");
    try {
      const response = await request("/api/preferences", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Preference load failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("preferences" in payload)) throw new Error("Invalid response");
      const stored = (payload as { preferences: unknown }).preferences;
      const parsed = stored === null ? null : parseAccountPreferences(stored);
      if (parsed !== null && !parsed.ok) throw new Error("Invalid saved preferences");
      if (disposed || currentGeneration !== generation) return;
      if (!retry && revisionBeforeLoad === localRevision && parsed !== null && parsed.ok) {
        applyRemote(parsed.value);
        ready = true;
        onStatus("saved");
      } else {
        // A user's click during loading wins; on a new account initialize from local settings.
        ready = true;
        ++localRevision;
        void flush();
      }
    } catch {
      if (!disposed && currentGeneration === generation) onStatus("error");
      // Never overwrite an unknown remote preference when its GET failed.
    } finally {
      if (currentGeneration === generation) loading = false;
    }
  }

  return {
    setAccount,
    localChanged: () => {
      if (disposed) return;
      ++localRevision;
      if (!ready && accountId && !loading) void setAccount(accountId, true);
      else void flush();
    },
    dispose: () => { disposed = true; ++generation; activeWrite?.abort(); },
  };
}
