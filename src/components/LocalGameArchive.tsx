"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, BookOpen, ExternalLink } from "lucide-react";

type StoredGame = { id: string; pgn: string; outcome: string; mode: "local" | "computer"; date: string };

/** Device-only history is user-controlled input; reject corrupt or oversized records. */
function readArchive(): StoredGame[] {
  try {
    const raw = localStorage.getItem("rookline-history") || "[]";
    if (raw.length > 2_000_000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 80).filter((entry): entry is StoredGame =>
      typeof entry === "object" && entry !== null &&
      typeof entry.id === "string" && entry.id.startsWith("local-") && entry.id.length <= 80 &&
      typeof entry.pgn === "string" && entry.pgn.length <= 100_000 &&
      typeof entry.outcome === "string" && entry.outcome.length <= 160 &&
      (entry.mode === "local" || entry.mode === "computer") &&
      typeof entry.date === "string" && Number.isFinite(Date.parse(entry.date)));
  } catch {
    return [];
  }
}

function downloadPgn(entry: StoredGame) {
  const url = URL.createObjectURL(new Blob([entry.pgn], { type: "application/x-chess-pgn" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rookline-${entry.mode}-game.pgn`;
  link.click();
  URL.revokeObjectURL(url);
}

export function LocalGameArchive() {
  const [games, setGames] = useState<StoredGame[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (mounted) setGames(readArchive()); };
    queueMicrotask(refresh);
    window.addEventListener("storage", refresh);
    return () => { mounted = false; window.removeEventListener("storage", refresh); };
  }, []);

  return <section className="stack" aria-label="Local game archive">
    <div><p className="overline">Saved on this device</p><h2 className="panel-title">Local and computer games</h2>
      <p className="muted">Completed games stored in this browser. Review a position or download the PGN to keep a copy.</p></div>
    {games === null ? <p className="muted" role="status">Loading local games…</p>
      : games.length === 0 ? <div className="text-panel stack"><BookOpen size={25} />
        <p className="muted">No completed games saved on this device yet.</p>
        <Link className="btn ghost" href="/play/local">Play a local game</Link></div>
        : <div className="stack">{games.map((entry) => <article className="text-panel stack" key={entry.id}>
          <div><strong>{entry.mode === "computer" ? "Computer game" : "Local game"} · {entry.outcome}</strong>
            <p className="muted">{new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })} · Saved on this device</p></div>
          <div className="game-actions">
            <Link className="btn primary" href={`/analysis?localGame=${encodeURIComponent(entry.id)}`}><ExternalLink size={16} /> Review game</Link>
            <button className="btn ghost" type="button" onClick={() => downloadPgn(entry)}><ArrowDownToLine size={16} /> Download PGN</button>
          </div>
        </article>)}</div>}
  </section>;
}
