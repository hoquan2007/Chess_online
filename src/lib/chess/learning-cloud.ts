import { knownLearningIds, type LearningKind } from "./learning-progress";

/** Account-bound additive synchronization. A different account cannot silently
 * inherit completion records left in shared browser storage by its predecessor. */
export function createLearningCloud(kind: LearningKind, {
  readLocal, applyMerged, onStatus, onAccountReset = () => {}, request = fetch,
  readOwner = () => {
    try { return { available: true, id: localStorage.getItem(`rookline-learning-owner:${kind}`) }; }
    catch { return { available: false, id: null }; }
  },
  writeOwner = (id: string | null) => {
    try {
      if (id === null) localStorage.removeItem(`rookline-learning-owner:${kind}`);
      else localStorage.setItem(`rookline-learning-owner:${kind}`, id);
      return true;
    }
    catch { return false; }
  },
}: {
  readLocal: () => string[];
  applyMerged: (ids: string[], replace: boolean, persist?: boolean) => void;
  onStatus: (message: string) => void;
  onAccountReset?: (memoryOnly?: boolean) => void;
  request?: typeof fetch;
  readOwner?: () => { available: boolean; id: string | null };
  writeOwner?: (id: string | null) => boolean;
}) {
  let accountId: string | null = null;
  let disposed = false;
  let generation = 0;
  let ignoredOwner = false;
  let verifiedStorageOwner = false;

  // An account switch in another tab must hide the old account's rendered
  // progress without clearing the new account's shared browser storage.
  function hideStaleAccount() {
    generation++;
    accountId = null;
    ignoredOwner = true;
    verifiedStorageOwner = false;
    applyMerged([], true, false);
    onAccountReset(true);
  }

  function resetPreviousAccount() {
    const owner = readOwner();
    // Another tab's account may now own the shared storage. Sign-out in this
    // tab must not erase that other account's progress or ownership marker.
    if (ignoredOwner || (accountId && owner.available && owner.id && owner.id !== accountId)) {
      hideStaleAccount();
      return;
    }
    if (!accountId && (!owner.available || !owner.id)) return;
    // Discard both persisted and rendered account progress on sign-out. An
    // anonymous session must not inherit it or upload it on its next sign-in.
    applyMerged([], true);
    onAccountReset();
    writeOwner(null);
    accountId = null;
    ignoredOwner = false;
    verifiedStorageOwner = false;
  }

  async function save(ids: string[]) {
    if (!accountId || disposed) return;
    if (!verifiedStorageOwner) {
      onStatus("Account progress loaded · browser storage unavailable");
      return;
    }
    const currentId = accountId;
    const currentGeneration = generation;
    // A different signed-in tab can replace shared localStorage after connect.
    // Never send its completions as this tab's authenticated account.
    const owner = readOwner();
    if (owner.available && owner.id !== currentId) {
      hideStaleAccount();
      onStatus("Account changed · reload to sync");
      return;
    }
    const completed = knownLearningIds(kind, ids);
    if (completed.length === 0) { onStatus("Cloud progress ready"); return; }
    try {
      const response = await request("/api/learning-progress", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Rookline-Account": currentId },
        body: JSON.stringify({ kind, ids: completed }),
      });
      if (disposed || currentId !== accountId || generation !== currentGeneration) return;
      if (!response.ok) {
        if (response.status === 409 || response.status === 401) {
          const latestOwner = readOwner();
          if (latestOwner.available && latestOwner.id === currentId) resetPreviousAccount();
          else hideStaleAccount();
        }
        onStatus(response.status === 409 || response.status === 401 ? "Account changed · reload to sync" : "Cloud sync unavailable · saved on device");
        return;
      }
      onStatus("Progress saved to account");
    } catch { if (!disposed && currentGeneration === generation) onStatus("Cloud sync unavailable · saved on device"); }
  }

  async function connect() {
    const currentGeneration = ++generation;
    try {
      const response = await request(`/api/learning-progress?kind=${kind}`, { credentials: "same-origin", cache: "no-store" });
      if (disposed || currentGeneration !== generation) return;
      if (!response.ok) {
        if (response.status === 401) resetPreviousAccount();
        onStatus("Device progress only · sign in to sync");
        return;
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid account response");
      const value = payload as Record<string, unknown>;
      if (typeof value.accountId !== "string" || !Array.isArray(value.ids)) throw new Error("Invalid account response");
      if (disposed || currentGeneration !== generation) return;
      accountId = value.accountId;
      ignoredOwner = false;
      const owner = readOwner();
      // An account transition or unavailable owner storage must not upload
      // somebody else's device-local completions to the new account.
      // Unknown ownership includes legacy device records: they must not be
      // attributed to the first account that signs in on a shared browser.
      const replace = !owner.available || owner.id !== accountId;
      const combined = knownLearningIds(kind, replace ? value.ids : [...readLocal(), ...value.ids]);
      if (replace) onAccountReset();
      // Claim ownership before writing completions so a tab observing storage
      // events can never render the new account's values under the old owner.
      const marked = writeOwner(accountId);
      const confirmed = readOwner();
      verifiedStorageOwner = marked && confirmed.available && confirmed.id === accountId;
      applyMerged(combined, replace, verifiedStorageOwner);
      // A failed ownership write may leave the previous account's marker in
      // storage. Keep this account's remote progress visible in memory, but do
      // not upload any device completions until ownership can be verified.
      if (!verifiedStorageOwner) {
        onStatus("Account progress loaded · browser storage unavailable");
        return;
      }
      await save(combined);
    } catch { if (!disposed && currentGeneration === generation) onStatus("Cloud sync unavailable · saved on device"); }
  }

  function onAuthEvent(event: string, signedInAccountId?: string | null) {
    if (disposed || (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_DELETED")) return;
    generation++;
    if (event === "SIGNED_IN") {
      verifiedStorageOwner = false;
      const owner = readOwner();
      if ((accountId && accountId !== signedInAccountId) ||
          (owner.available && owner.id !== null && owner.id !== signedInAccountId)) {
        hideStaleAccount();
      }
      accountId = null;
      void connect();
    } else {
      resetPreviousAccount();
      accountId = null;
      onStatus("Device progress only · sign in to sync");
    }
  }

  // Browser storage events are shared across signed-in tabs. The application
  // must never render another account's locally persisted progress.
  function ownsDeviceStorage() {
    if (disposed || ignoredOwner) return false;
    const owner = readOwner();
    return owner.available && owner.id === accountId;
  }

  function onOwnerStorageChanged() {
    if (!ownsDeviceStorage()) {
      hideStaleAccount();
      onStatus("Account changed · reload to sync");
    }
  }

  return { connect, save, onAuthEvent, ownsDeviceStorage, onOwnerStorageChanged,
    dispose: () => { disposed = true; generation++; accountId = null; verifiedStorageOwner = false; } };
}
