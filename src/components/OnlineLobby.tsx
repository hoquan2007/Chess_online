"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { timeControls, type TimeControl } from "@/lib/online/games";

type GamePreview = { id: string; white_id: string; black_id: string | null; status: string; base_ms: number; increment_ms: number; ply: number; created_at: string; result: string | null };

export function OnlineLobby({ friend = false }: { friend?: boolean }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [games, setGames] = useState<GamePreview[]>([]);
  const [control, setControl] = useState<TimeControl>("5+0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = !!browserSupabase();

  const refresh = useCallback(async () => {
    const client = browserSupabase();
    if (!client) return;
    const { data: { user } } = await client.auth.getUser();
    setUserId(user?.id ?? null);
    setReady(true);
    if (!user) return;
    try {
      const response = await fetch("/api/games", { cache: "no-store" });
      const json = await response.json();
      if (response.ok) setGames(json.games ?? []);
      else setMessage(json.error ?? "Could not load your games.");
    } catch { setMessage("You appear to be offline. Reconnect and retry."); }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function createGame() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ control }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Challenge could not be created.");
      router.push(`/game/${json.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unknown error"); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await browserSupabase()?.auth.signOut();
    setGames([]); setUserId(null); router.refresh();
  }

  return <section className="stack">
    <div><p className="overline">{friend ? "Private challenge" : "Your online table"}</p><h1 className="page-title">{friend ? "Invite someone to play." : "The online board awaits."}</h1><p className="muted">Create an unrated private match, share the link with a friend and play from different devices. Your moves are saved on the server.</p></div>
    {!configured ? <div className="text-panel stack"><h2>Online service not configured</h2><p className="muted">Add the Supabase environment variables and apply the reviewed migration to enable accounts and online games.</p><Link className="btn ghost" href="/play/local">Play on one board</Link></div> : !ready ? <p role="status" className="status">Checking your session…</p> : !userId ? <div className="text-panel stack"><h2>Sign in to play</h2><p className="muted">You need an account to save server-authoritative games and accept a private challenge.</p><div className="game-actions"><Link className="btn primary" href="/login?next=%2Fplay%2Fonline">Sign in</Link><Link className="btn ghost" href="/register?next=%2Fplay%2Fonline">Create account</Link></div></div> : <>
      <div className="text-panel stack"><div><h2>New private game</h2><p className="muted">Choose a clock, then send the generated link to your opponent.</p></div>
        <div role="group" aria-label="Time control" className="pill-group">{(Object.keys(timeControls) as TimeControl[]).map((item) => <button type="button" className={`pill ${control === item ? "active" : ""}`} aria-pressed={control === item} key={item} onClick={() => setControl(item)}>{item}</button>)}</div>
        <div className="game-actions"><button type="button" disabled={busy} className="btn primary" onClick={() => void createGame()}>{busy ? "Creating…" : "Create challenge"}</button><button type="button" className="btn ghost" onClick={() => void signOut()}>Sign out</button></div>
      </div>
      <div className="text-panel stack"><div className="game-actions" style={{ justifyContent: "space-between" }}><h2>Your games</h2><button className="btn ghost" type="button" onClick={() => void refresh()}>Refresh</button></div>
        {games.length ? games.map((game) => <Link className="status" href={`/game/${game.id}`} key={game.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", flexWrap: "wrap" }}><span>{game.status === "waiting" ? "Waiting for opponent" : game.status === "active" ? "Game in progress" : `Finished: ${game.result ?? game.status}`} · {game.white_id === userId ? "White" : "Black"}</span><span className="muted">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · {game.ply} half-moves →</span></Link>) : <p className="muted">No online games yet. Create one above to get started.</p>}
      </div>
    </>}
    {message && <p role="alert" className="status">{message}</p>}
  </section>;
}
