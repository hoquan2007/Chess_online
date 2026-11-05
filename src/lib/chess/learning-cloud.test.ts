import { describe, expect, it, vi } from "vitest";
import { createLearningCloud } from "./learning-cloud";

const accountA = "10000000-0000-4000-8000-000000000001";
const accountB = "20000000-0000-4000-8000-000000000002";

function response(accountId: string, ids: string[]) {
  return new Response(JSON.stringify({ accountId, ids }), { status: 200 });
}

describe("learning progress cloud and account changes", () => {
  it("clears the signed-out account's completions and device-only practice", async () => {
    let owner: string | null = accountA;
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    const request = vi.fn(async () => response(accountA, ["mate-001"]));
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onAccountReset, onStatus: vi.fn(),
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }),
      writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    cloud.onAuthEvent("SIGNED_OUT");
    expect(applyMerged).toHaveBeenLastCalledWith([], true);
    expect(onAccountReset).toHaveBeenCalledOnce();
    expect(owner).toBeNull();
    await cloud.save(["mate-001"]);
    expect(request).toHaveBeenCalledTimes(2); // initial GET and POST only
  });

  it("clears orphaned account progress on unauthenticated reload, but retains anonymous progress", async () => {
    let owner: string | null = accountA;
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    const request = vi.fn(async () => new Response("{}", { status: 401 }));
    const cloud = createLearningCloud("study", {
      readLocal: () => ["italian-game:w"], applyMerged, onAccountReset, onStatus: vi.fn(),
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }),
      writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    expect(applyMerged).toHaveBeenCalledWith([], true);
    expect(onAccountReset).toHaveBeenCalledOnce();
    expect(owner).toBeNull();
    await cloud.connect();
    cloud.onAuthEvent("SIGNED_OUT");
    expect(applyMerged).toHaveBeenCalledTimes(1);
    expect(onAccountReset).toHaveBeenCalledOnce();
  });

  it("ignores an old account's delayed response after sign-out", async () => {
    let finish!: (value: Response) => void;
    const request = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const applyMerged = vi.fn();
    const onStatus = vi.fn();
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => [], applyMerged, onStatus, request: request as typeof fetch,
      readOwner: () => ({ available: true, id: accountA }), writeOwner: () => true,
    });
    const pending = cloud.connect();
    cloud.onAuthEvent("SIGNED_OUT");
    finish(response(accountA, ["mate-001"]));
    await pending;
    expect(applyMerged).toHaveBeenCalledExactlyOnceWith([], true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenLastCalledWith("Device progress only · sign in to sync");
  });

  it("a newer signed-in account wins over the previous in-flight cloud GET", async () => {
    const pending: Array<(value: Response) => void> = [];
    const request = vi.fn((_url: string, options?: RequestInit) => options?.method === "POST"
      ? Promise.resolve(new Response("{}", { status: 200 }))
      : new Promise<Response>((resolve) => pending.push(resolve)));
    const applyMerged = vi.fn();
    let owner: string | null = accountA;
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onStatus: vi.fn(), request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }), writeOwner: (id) => { owner = id; return true; },
    });
    const obsolete = cloud.connect();
    cloud.onAuthEvent("SIGNED_IN", accountB);
    expect(pending).toHaveLength(2);
    pending[1](response(accountB, ["mate-002"]));
    await vi.waitFor(() => expect(applyMerged).toHaveBeenLastCalledWith(["mate-002"], true, true));
    pending[0](response(accountA, ["mate-001"]));
    await obsolete;
    expect(applyMerged).toHaveBeenCalledWith(["mate-002"], true, true);
    expect(owner).toBe(accountB);
    expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("merges same-account completions from a second device before saving", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountA, ["mate-002"]));
    const applyMerged = vi.fn();
    const onStatus = vi.fn();
    const writeOwner = vi.fn(() => true);
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onStatus,
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: accountA }), writeOwner,
    });
    await cloud.connect();
    expect(applyMerged).toHaveBeenCalledWith(["mate-001", "mate-002"], false, true);
    expect(writeOwner).toHaveBeenCalledWith(accountA);
    expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toEqual({ kind: "puzzle", ids: ["mate-001", "mate-002"] });
    expect(onStatus).toHaveBeenLastCalledWith("Progress saved to account");
  });

  it("never uploads the prior account's progress on shared devices", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountB, ["mate-002"]));
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    let owner: string | null = accountA;
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onAccountReset, onStatus: vi.fn(), request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }), writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    expect(applyMerged).toHaveBeenCalledWith(["mate-002"], true, true);
    expect(onAccountReset).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[1][1]!.body as string).ids).toEqual(["mate-002"]);
  });

  it("does not attach unowned device progress to the first account that signs in", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountA, ["mate-002"]));
    const applyMerged = vi.fn();
    let owner: string | null = null;
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onStatus: vi.fn(),
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }),
      writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    expect(applyMerged).toHaveBeenCalledWith(["mate-002"], true, true);
    expect(JSON.parse(request.mock.calls[1][1]!.body as string).ids).toEqual(["mate-002"]);
  });

  it("fails closed when browser storage ownership cannot be checked", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountB, []));
    const applyMerged = vi.fn();
    await createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onStatus: vi.fn(), request: request as typeof fetch,
      readOwner: () => ({ available: false, id: null }), writeOwner: () => false,
    }).connect();
    expect(applyMerged).toHaveBeenCalledWith([], true, false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps remote progress visible without uploading another account's local data if ownership cannot be written", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountB, ["mate-002"]));
    const applyMerged = vi.fn();
    const onStatus = vi.fn();
    const onAccountReset = vi.fn();
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onAccountReset, onStatus,
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: accountA }),
      writeOwner: () => false,
    });
    await cloud.connect();
    expect(onAccountReset).toHaveBeenCalledOnce();
    expect(applyMerged).toHaveBeenLastCalledWith(["mate-002"], true, false);
    expect(onStatus).toHaveBeenLastCalledWith("Account progress loaded · browser storage unavailable");
    await cloud.save(["mate-001", "mate-002"]);
    expect(applyMerged).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(cloud.ownsDeviceStorage()).toBe(false);
  });

  it("stops saving after the server detects an account change", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 409 }) : response(accountA, []));
    const onStatus = vi.fn();
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => [], applyMerged: vi.fn(), onStatus, request: request as typeof fetch,
      readOwner: () => ({ available: true, id: accountA }), writeOwner: () => true,
    });
    await cloud.connect();
    await cloud.save(["mate-001"]);
    await cloud.save(["mate-002"]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenLastCalledWith("Account changed · reload to sync");
  });

  it("does not upload another tab's completions when the storage owner changes", async () => {
    const request = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === "POST" ? new Response("{}", { status: 200 }) : response(accountA, ["mate-001"]));
    const onStatus = vi.fn();
    let owner: string | null = accountA;
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onAccountReset, onStatus,
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }), writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    owner = accountB;
    await cloud.save(["mate-001", "mate-002"]);
    expect(request).toHaveBeenCalledTimes(2); // initial GET + same-owner POST only
    expect(onStatus).toHaveBeenLastCalledWith("Account changed · reload to sync");
    expect(applyMerged).toHaveBeenLastCalledWith([], true, false);
    expect(onAccountReset).toHaveBeenCalledWith(true);
    expect(owner).toBe(accountB);
  });

  it("hides rendered progress after another tab changes storage ownership", async () => {
    let owner: string | null = accountA;
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    const request = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? new Response("{}", { status: 200 }) : response(accountA, ["mate-001"]));
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => ["mate-001"], applyMerged, onAccountReset, onStatus: vi.fn(),
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }),
      writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    expect(cloud.ownsDeviceStorage()).toBe(true);
    owner = accountB;
    cloud.onOwnerStorageChanged();
    expect(cloud.ownsDeviceStorage()).toBe(false);
    expect(applyMerged).toHaveBeenLastCalledWith([], true, false);
    expect(onAccountReset).toHaveBeenCalledWith(true);
    expect(owner).toBe(accountB);
    owner = null; // The other tab signs out; this stale tab still owns no device progress.
    expect(cloud.ownsDeviceStorage()).toBe(false);
    await cloud.save(["mate-002"]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("clears the old account after an HTTP account conflict", async () => {
    let owner: string | null = accountA;
    const applyMerged = vi.fn();
    const onAccountReset = vi.fn();
    const request = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? new Response("{}", { status: 409 }) : response(accountA, ["mate-001"]));
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => [], applyMerged, onAccountReset, onStatus: vi.fn(),
      request: request as typeof fetch,
      readOwner: () => ({ available: true, id: owner }),
      writeOwner: (id) => { owner = id; return true; },
    });
    await cloud.connect();
    expect(applyMerged).toHaveBeenLastCalledWith([], true);
    expect(onAccountReset).toHaveBeenCalledOnce();
    expect(owner).toBeNull();
    await cloud.save(["mate-001"]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
