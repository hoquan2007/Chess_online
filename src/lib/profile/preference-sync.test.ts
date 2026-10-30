import { describe, expect, it, vi } from "vitest";
import { createPreferenceSync } from "./preference-sync";
import type { AccountPreferences } from "./preferences";

const response = (preferences: AccountPreferences | null) =>
  new Response(JSON.stringify({ preferences }), { status: 200 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const nextTurn = async () => { await new Promise((done) => setTimeout(done, 0)); };

function harness(request: typeof fetch) {
  let local: AccountPreferences = { theme: "dark", sounds_enabled: true };
  const applyRemote = vi.fn((value: AccountPreferences) => { local = value; });
  const onStatus = vi.fn();
  const sync = createPreferenceSync({ request, readLocal: () => local, applyRemote, onStatus });
  return {
    sync, applyRemote, onStatus,
    local: () => local,
    click: (next: AccountPreferences) => { local = next; sync.localChanged(); },
  };
}

describe("account preference synchronization", () => {
  it("loads existing remote account settings without generating a write", async () => {
    const request = vi.fn().mockResolvedValue(response({ theme: "light", sounds_enabled: false }));
    const { sync, local, onStatus, applyRemote } = harness(request);
    await sync.setAccount("user-a");
    expect(local()).toEqual({ theme: "light", sounds_enabled: false });
    expect(applyRemote).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    sync.dispose();
  });

  it("initializes a missing account row from device settings", async () => {
    const request = vi.fn().mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response({ theme: "dark", sounds_enabled: true }));
    const { sync, onStatus } = harness(request);
    await sync.setAccount("new-user");
    await nextTurn();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toMatchObject({ method: "PATCH", credentials: "same-origin" });
    expect(request.mock.calls[1][1].headers["X-Rookline-Account"]).toBe("new-user");
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ theme: "dark", sounds_enabled: true });
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    sync.dispose();
  });

  it("serializes rapid updates so the newest preference is persisted last", async () => {
    const firstWrite = deferred<Response>();
    const request = vi.fn().mockResolvedValueOnce(response({ theme: "dark", sounds_enabled: true }))
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValueOnce(response({ theme: "dark", sounds_enabled: false }));
    const { sync, click, onStatus } = harness(request);
    await sync.setAccount("user-a");
    click({ theme: "light", sounds_enabled: true });
    click({ theme: "dark", sounds_enabled: false });
    expect(request).toHaveBeenCalledTimes(2);
    firstWrite.resolve(response({ theme: "light", sounds_enabled: true }));
    await nextTurn();
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.parse(request.mock.calls[2][1].body)).toEqual({ theme: "dark", sounds_enabled: false });
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    sync.dispose();
  });

  it("does not overwrite a user click made while remote settings load", async () => {
    const loaded = deferred<Response>();
    const request = vi.fn().mockImplementationOnce(() => loaded.promise)
      .mockResolvedValueOnce(response({ theme: "light", sounds_enabled: true }));
    const { sync, click, applyRemote } = harness(request);
    const pending = sync.setAccount("user-a");
    click({ theme: "light", sounds_enabled: true });
    loaded.resolve(response({ theme: "dark", sounds_enabled: false }));
    await pending;
    await nextTurn();
    expect(applyRemote).not.toHaveBeenCalled();
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ theme: "light", sounds_enabled: true });
    sync.dispose();
  });

  it("ignores a stale previous-account response after the account changes", async () => {
    const oldLoad = deferred<Response>();
    const request = vi.fn().mockImplementationOnce(() => oldLoad.promise)
      .mockResolvedValueOnce(response({ theme: "light", sounds_enabled: true }));
    const { sync, applyRemote } = harness(request);
    const first = sync.setAccount("user-a");
    await sync.setAccount("user-b");
    oldLoad.resolve(response({ theme: "dark", sounds_enabled: false }));
    await first;
    expect(applyRemote).toHaveBeenCalledOnce();
    expect(applyRemote).toHaveBeenCalledWith({ theme: "light", sounds_enabled: true });
    sync.dispose();
  });

  it("does not let a failed old-account write block new-account initialization", async () => {
    const oldWrite = deferred<Response>();
    const request = vi.fn().mockResolvedValueOnce(response({ theme: "dark", sounds_enabled: true }))
      .mockImplementationOnce(() => oldWrite.promise)
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response({ theme: "light", sounds_enabled: false }));
    const { sync, click, onStatus } = harness(request);
    await sync.setAccount("user-a");
    click({ theme: "light", sounds_enabled: false });
    const signal: AbortSignal = request.mock.calls[1][1].signal;
    expect(signal.aborted).toBe(false);
    await sync.setAccount("user-b");
    expect(signal.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
    oldWrite.resolve(new Response("failed", { status: 503 }));
    await nextTurn();
    expect(request).toHaveBeenCalledTimes(4);
    expect(JSON.parse(request.mock.calls[3][1].body)).toEqual({ theme: "light", sounds_enabled: false });
    expect(request.mock.calls[3][1].headers["X-Rookline-Account"]).toBe("user-b");
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    sync.dispose();
  });

  it("never overwrites unknown remote data after failed GET, and retries on next click", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValueOnce(response({ theme: "light", sounds_enabled: false }))
      .mockResolvedValueOnce(response({ theme: "dark", sounds_enabled: false }));
    const { sync, click, applyRemote, onStatus } = harness(request);
    await sync.setAccount("user-a");
    expect(onStatus).toHaveBeenLastCalledWith("error");
    expect(request).toHaveBeenCalledTimes(1);
    click({ theme: "dark", sounds_enabled: false });
    await nextTurn();
    expect(applyRemote).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(3);
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    sync.dispose();
  });
});
