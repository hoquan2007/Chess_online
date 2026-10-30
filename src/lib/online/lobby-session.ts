export type LobbyGame = {
  id: string;
  white_id: string;
  black_id: string | null;
  status: string;
  base_ms: number;
  increment_ms: number;
  ply: number;
  created_at: string;
  result: string | null;
};

export type LobbyState = {
  userId: string | null;
  games: LobbyGame[];
  ready: boolean;
  message: string;
};

type LobbyDependencies = {
  verifyUser: () => Promise<string | null>;
  loadGames: (signal: AbortSignal) => Promise<LobbyGame[]>;
  onState: (state: LobbyState) => void;
};

/** Account-scoped asynchronous updates: never render a response from an older session. */
export function createLobbySession({ verifyUser, loadGames, onState }: LobbyDependencies) {
  let state: LobbyState = { userId: null, games: [], ready: false, message: "" };
  let request = 0;
  let accountEpoch = 0;
  let controller: AbortController | null = null;
  let disposed = false;

  const publish = (changes: Partial<LobbyState>) => {
    if (disposed) return;
    state = { ...state, ...changes };
    onState(state);
  };

  const invalidate = () => {
    if (disposed) return;
    request++;
    accountEpoch++;
    controller?.abort();
    controller = null;
    publish({ userId: null, games: [], ready: true, message: "" });
  };

  const refresh = async () => {
    if (disposed) return;
    const currentRequest = ++request;
    controller?.abort();
    const active = new AbortController();
    controller = active;
    const current = () => !disposed && !active.signal.aborted && currentRequest === request;

    let verifiedId: string | null;
    try {
      verifiedId = await verifyUser();
    } catch {
      if (current()) {
        invalidate();
        publish({ message: "Could not verify your session. Reconnect and retry." });
      }
      return;
    }
    if (!current()) return;

    if (state.userId !== verifiedId) {
      accountEpoch++;
      publish({ userId: verifiedId, games: [], ready: true, message: "" });
    } else {
      publish({ ready: true, message: "" });
    }
    if (!verifiedId) return;

    try {
      const games = await loadGames(active.signal);
      if (!current() || state.userId !== verifiedId) return;
      publish({
        games: games.filter((game) => game && (game.white_id === verifiedId || game.black_id === verifiedId)),
        message: "",
      });
    } catch (error) {
      if (current()) publish({ message: error instanceof Error ? error.message : "Could not load your games." });
    }
  };

  return {
    refresh,
    invalidate,
    token: () => state.userId && !disposed ? { id: state.userId, epoch: accountEpoch } : null,
    isCurrent: (token: { id: string; epoch: number }) => !disposed && token.id === state.userId && token.epoch === accountEpoch,
    dispose: () => { disposed = true; request++; accountEpoch++; controller?.abort(); },
  };
}
