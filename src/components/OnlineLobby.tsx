"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { timeControls, type TimeControl } from "@/lib/online/games";
import { createLobbySession, type LobbyGame } from "@/lib/online/lobby-session";

export function OnlineLobby({ friend = false }: { friend?: boolean }) {
  const router = useRouter();
  const client = useMemo(() => browserSupabase(), []);
  const session = useRef<ReturnType<typeof createLobbySession> | null>(null);
  const creating = useRef<AbortController | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [control, setControl] = useState<TimeControl>("5+0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = !!client;
  const authDestination = encodeURIComponent(friend ? "/play/friend" : "/play/online");

  const refresh = useCallback(() => void session.current?.refresh(), []);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const manager = createLobbySession({
      verifyUser: async () => {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        return data.user?.id ?? null;
      },
      loadGames: async (signal) => {
        const response = await fetch("/api/games", { cache: "no-store", signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error ?? "Could not load your games.");
        if (!Array.isArray(json.games)) throw new Error("Invalid game list from server.");
        return json.games as LobbyGame[];
      },
      onState: (next) => {
        setUserId(next.userId);
        setReady(next.ready);
        setGames(next.games);
        setMessage(next.message);
      },
    });
    session.current = manager;
    queueMicrotask(() => { if (active) void manager.refresh(); });
    const interval = window.setInterval(() => void manager.refresh(), 8000);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, authSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event !== "USER_UPDATED" && (authSession?.user.id ?? null) === (manager.token()?.id ?? null)) return;
      manager.invalidate();
      creating.current?.abort();
      setBusy(false);
      // Supabase auth callbacks run under an internal lock; defer getUser until it exits.
      window.setTimeout(() => { if (active) void manager.refresh(); }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearInterval(interval);
      creating.current?.abort();
      manager.dispose();
      if (session.current === manager) session.current = null;
    };
  }, [client]);

  async function createGame() {
    const manager = session.current;
    const token = manager?.token();
    if (!manager || !token || creating.current) return;
    const abort = new AbortController();
    creating.current = abort;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ control }), signal: abort.signal });
      const json = await response.json();
      if (abort.signal.aborted || !manager.isCurrent(token)) return;
      if (!response.ok) throw new Error(json.error ?? "Challenge could not be created.");
      router.push(`/game/${json.id}`);
    } catch (error) {
      if (!abort.signal.aborted && manager.isCurrent(token)) setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      if (creating.current === abort) { creating.current = null; setBusy(false); }
    }
  }

  async function signOut() {
    session.current?.invalidate();
    creating.current?.abort();
    creating.current = null;
    setBusy(false);
    try {
      const { error } = await client?.auth.signOut() ?? { error: null };
      if (error) throw error;
      router.refresh();
    } catch {
      refresh();
      setMessage("Sign out failed. Please try again.");
    }
  }

  return <section className="stack">
    <div><p className="overline">{friend ? "Private challenge" : "Your online table"}</p><h1 className="page-title">{friend ? "Invite someone to play." : "The online board awaits."}</h1><p className="muted">Create an unrated private match, share the link with a friend and play from different devices. Your moves are saved on the server.</p></div>
    {!configured ? <div className="text-panel stack"><h2>Online service not configured</h2><p className="muted">Add the Supabase environment variables and apply the reviewed migration to enable accounts and online games.</p><Link className="btn ghost" href="/play/local">Play on one board</Link></div> : !ready ? <p role="status" className="status">Checking your session…</p> : !userId ? <div className="text-panel stack"><h2>Sign in to play</h2><p className="muted">You need an account to save server-authoritative games and accept a private challenge.</p><div className="game-actions"><Link className="btn primary" href={`/login?next=${authDestination}`}>Sign in</Link><Link className="btn ghost" href={`/register?next=${authDestination}`}>Create account</Link></div></div> : <>
      <div className="text-panel stack"><div><h2>New private game</h2><p className="muted">Choose a clock, then send the generated link to your opponent.</p></div>
        <div role="group" aria-label="Time control" className="pill-group">{(Object.keys(timeControls) as TimeControl[]).map((item) => <button type="button" className={`pill ${control === item ? "active" : ""}`} aria-pressed={control === item} key={item} onClick={() => setControl(item)}>{item}</button>)}</div>
        <div className="game-actions"><button type="button" disabled={busy} className="btn primary" onClick={() => void createGame()}>{busy ? "Creating…" : "Create challenge"}</button><button type="button" className="btn ghost" onClick={() => void signOut()}>Sign out</button></div>
      </div>
      <div className="text-panel stack"><div className="game-actions" style={{ justifyContent: "space-between" }}><h2>Your games</h2><button className="btn ghost" type="button" onClick={() => void refresh()}>Refresh</button></div>
        {games.length ? games.map((game) => <Link className="status" href={`/game/${game.id}`} key={game.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", flexWrap: "wrap" }}><span>{game.status === "waiting" ? "Waiting for opponent" : game.status === "active" ? "Game in progress" : game.status === "cancelled" ? "Challenge cancelled" : `Finished: ${game.result ?? game.status}`} · {game.white_id === userId ? "White" : "Black"}</span><span className="muted">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · {game.ply} half-moves →</span></Link>) : <p className="muted">No online games yet. Create one above to get started.</p>}
        <Link href="/games" className="btn ghost" style={{ alignSelf: "flex-start" }}>Browse full game history</Link>
      </div>
    </>}
    {message && <p role="alert" className="status">{message}</p>}
  </section>;
}
