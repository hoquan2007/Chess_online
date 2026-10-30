import { describe, expect, it, vi } from "vitest";
import { createLobbySession, type LobbyGame, type LobbyState } from "./lobby-session";

const game = (id: string, white_id: string): LobbyGame => ({
  id, white_id, black_id: null, status: "waiting", base_ms: 300_000,
  increment_ms: 0, ply: 0, created_at: "2026-10-31T00:00:00Z", result: null,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("online lobby account isolation", () => {
  it("discards previous-account responses even if the cancelled request still finishes", async () => {
    let identity = "alice";
    const old = deferred<LobbyGame[]>();
    const next = deferred<LobbyGame[]>();
    const onState = vi.fn<(state: LobbyState) => void>();
    const session = createLobbySession({
      verifyUser: async () => identity,
      loadGames: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise),
      onState,
    });
    const first = session.refresh();
    await Promise.resolve();
    const oldToken = session.token();
    expect(oldToken).toEqual({ id: "alice", epoch: 1 });
    session.invalidate();
    identity = "bob";
    const second = session.refresh();
    await Promise.resolve();
    next.resolve([game("bob-game", "bob"), game("foreign-game", "alice")]);
    await second;
    old.resolve([game("alice-game", "alice")]);
    await first;
    expect(session.isCurrent(oldToken!)).toBe(false);
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      userId: "bob", games: [game("bob-game", "bob")], message: "",
    });
  });

  it("keeps the newest list when two refreshes resolve in reverse order", async () => {
    const firstLoad = deferred<LobbyGame[]>();
    const secondLoad = deferred<LobbyGame[]>();
    const onState = vi.fn<(state: LobbyState) => void>();
    const session = createLobbySession({
      verifyUser: async () => "alice",
      loadGames: vi.fn().mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise),
      onState,
    });
    const first = session.refresh();
    await Promise.resolve();
    const second = session.refresh();
    await Promise.resolve();
    secondLoad.resolve([game("new", "alice")]);
    await second;
    firstLoad.resolve([game("old", "alice")]);
    await first;
    expect(onState.mock.lastCall?.[0].games.map((item) => item.id)).toEqual(["new"]);
  });

  it("hides old games when authentication cannot be verified", async () => {
    let fail = false;
    const onState = vi.fn<(state: LobbyState) => void>();
    const session = createLobbySession({
      verifyUser: async () => { if (fail) throw new Error("network"); return "alice"; },
      loadGames: async () => [game("private", "alice")], onState,
    });
    await session.refresh();
    fail = true;
    await session.refresh();
    expect(onState.mock.lastCall?.[0]).toMatchObject({ userId: null, games: [], ready: true });
    expect(onState.mock.lastCall?.[0].message).toMatch(/verify your session/);
  });

  it("never publishes results after unmount", async () => {
    const late = deferred<string | null>();
    const onState = vi.fn();
    const session = createLobbySession({
      verifyUser: () => late.promise, loadGames: async () => [game("private", "alice")], onState,
    });
    const pending = session.refresh();
    session.dispose();
    late.resolve("alice");
    await pending;
    expect(onState).not.toHaveBeenCalled();
  });
});
