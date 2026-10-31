"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, BookOpen, ExternalLink, Trash2, Upload } from "lucide-react";
import { localArchiveKey, maxLocalArchiveBytes, mergeLocalGameArchives, parseLocalGameBackup, parseStoredLocalGames, serializeLocalGameBackup, type StoredLocalGame } from "@/lib/chess/local-archive";

function readArchive(): StoredLocalGame[] {
  try {
    return parseStoredLocalGames(localStorage.getItem(localArchiveKey) || "[]");
  } catch { return []; }
}

function downloadFile(content: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadPgn(entry: StoredLocalGame) {
  downloadFile(entry.pgn, `rookline-${entry.mode}-game.pgn`, "application/x-chess-pgn");
}

export function LocalGameArchive() {
  const [games, setGames] = useState<StoredLocalGame[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const importRequest = useRef(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (mounted) setGames(readArchive()); };
    queueMicrotask(refresh);
    window.addEventListener("storage", refresh);
    return () => { mounted = false; window.removeEventListener("storage", refresh); };
  }, []);

  const deleteGame = (id: string) => {
    try {
      // Read once more before writing so an import in another tab is preserved.
      const remaining = readArchive().filter((entry) => entry.id !== id);
      localStorage.setItem(localArchiveKey, JSON.stringify(remaining));
      setGames(remaining);
      setConfirmDelete(null);
      setStatus("Game deleted from this device.");
    } catch { setStatus("Could not delete this game. Browser storage is unavailable."); }
  };

  const exportBackup = () => {
    try {
      const { content, exported, skipped } = serializeLocalGameBackup(readArchive());
      if (!exported) { setStatus("No replayable games available to back up."); return; }
      downloadFile(content, "rookline-local-games.json", "application/json");
      setStatus(`${exported} ${exported === 1 ? "game" : "games"} backed up.${skipped ? ` ${skipped} corrupt games skipped.` : ""}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not create backup."); }
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const request = ++importRequest.current;
    try {
      if (file.size > maxLocalArchiveBytes) throw new Error("Backup exceeds the 2 MB limit.");
      const incoming = parseLocalGameBackup(await file.text());
      if (request !== importRequest.current) return;
      const { games: merged, added } = mergeLocalGameArchives(readArchive(), incoming);
      localStorage.setItem(localArchiveKey, JSON.stringify(merged));
      setGames(merged);
      setConfirmDelete(null);
      setStatus(`${added} ${added === 1 ? "game" : "games"} restored; existing games retained.${incoming.length > added ? ` ${incoming.length - added} already saved or beyond the 80-game limit.` : ""}`);
    } catch (error) {
      if (request === importRequest.current) setStatus(error instanceof Error ? error.message : "Could not import backup.");
    }
  };

  return <section className="stack" aria-label="Local game archive">
    <div><p className="overline">Saved on this device</p><h2 className="panel-title">Local and computer games</h2>
      <p className="muted">Completed games stored in this browser. Review a position or download the PGN to keep a copy.</p></div>
    <div className="game-actions">
      <button className="btn ghost" type="button" onClick={exportBackup} disabled={!games?.length}><ArrowDownToLine size={16} /> Back up games</button>
      <label className="btn ghost"><Upload size={16} /> Restore backup<input className="sr-only" type="file" accept=".json,application/json" aria-label="Restore Rookline backup file" onChange={(event) => void importBackup(event)} /></label>
    </div>
    {status && <p role="status" className="muted">{status}</p>}
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
            {confirmDelete === entry.id ? <>
              <button className="btn ghost" type="button" onClick={() => deleteGame(entry.id)}>Confirm delete</button>
              <button className="btn ghost" type="button" onClick={() => setConfirmDelete(null)}>Keep game</button>
            </> : <button className="btn ghost" type="button" aria-label={`Delete ${entry.mode} game saved ${new Date(entry.date).toLocaleDateString("en-US", { dateStyle: "medium" })}`} onClick={() => setConfirmDelete(entry.id)}><Trash2 size={16} /> Delete</button>}
          </div>
        </article>)}</div>}
  </section>;
}
