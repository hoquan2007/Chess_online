"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Swords } from "lucide-react";
import type { GameHistoryEntry } from "@/lib/online/history";

export function OnlineGameHistory({ initialGames, initialCursor, userId }: {
  initialGames: GameHistoryEntry[];
  initialCursor: string | null;
  userId: string;
}) {
  const [games, setGames] = useState(initialGames);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/games?cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      if (response.status === 401) throw new Error("Your session has expired. Sign in again to view the rest of your games.");
      if (!response.ok) throw new Error("Could not load more games. Try again.");
      const result: { games: GameHistoryEntry[]; nextCursor: string | null } = await response.json();
      if (!Array.isArray(result.games) || (result.nextCursor !== null && typeof result.nextCursor !== "string")) {
        throw new Error("Game history response was invalid.");
      }
      setGames((old) => {
        const known = new Set(old.map((game) => game.id));
        return [...old, ...result.games.filter((game) => !known.has(game.id))];
      });
      setCursor(result.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more games.");
    } finally {
      setBusy(false);
    }
  }

  if (!games.length) return <div className="text-panel stack"><BookOpen size={32} /><h2>Your archive starts with a game.</h2>
    <p className="muted">Create a private online challenge. Finished and ongoing games will appear here after they are saved.</p>
    <Link className="btn primary" href="/play/online">Create your first game</Link></div>;

  return <section className="stack" aria-label="Online game history">
    {games.map((game) => {
      const ownColor = game.white_id === userId ? "White" : "Black";
      const outcome = game.status === "completed" ? game.winner_id ? game.winner_id === userId ? "Won" : "Lost" : "Draw"
        : game.status === "waiting" ? "Waiting for opponent" : game.status === "cancelled" ? "Challenge cancelled" : "In progress";
      return <Link key={game.id} className="text-panel" href={`/game/${game.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <span style={{ display: "grid", gap: 6 }}><strong style={{ display: "flex", alignItems: "center", gap: 10 }}><Swords size={18} />{outcome} · {ownColor}</strong>
          <span className="muted">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · {game.ply} half-moves · {new Date(game.created_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</span>
          <small className="muted">{game.result ?? (game.status === "completed" ? "Completed" : "Unrated private match")}</small></span><ArrowUpRight size={19} />
      </Link>;
    })}
    {cursor && <div className="game-actions"><button className="btn ghost" type="button" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading history…" : "Load older games"}</button></div>}
    {error && <p className="status" role="alert">{error}</p>}
  </section>;
}
