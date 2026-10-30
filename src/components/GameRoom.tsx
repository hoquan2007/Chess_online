"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowDownToLine, ArrowLeftRight, ClipboardCopy, Flag, Volume2, VolumeX } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import { displayedClock, estimatedServerTime, exportOnlinePgn, isOlderGameSnapshot, reconcileServerClockSample, replayGame, type OnlineGame, type ServerClockSample } from "@/lib/online/games";
import { availableDrawClaims, parseCoordinateMove, selectPromotion, type DrawClaim } from "@/lib/chess/rules";
import { PromotionDialog } from "@/components/PromotionDialog";
import { moveSoundsEnabled, playMoveSound, setMoveSoundsEnabled, unlockMoveAudio } from "@/lib/chess/sound";

type Viewer = "w" | "b";
type Promotion = "q" | "r" | "b" | "n";

function clockLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GameRoom({ id }: { id: string }) {
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [joinable, setJoinable] = useState(false);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  const [keyboardMove, setKeyboardMove] = useState("");
  const [keyboardError, setKeyboardError] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const [clockSync, setClockSync] = useState(() => ({ serverNow: Date.now(), receivedAt: performance.now() }));
  // Keep the accepted game and clock in refs so concurrent fetch completions
  // cannot use a stale React state closure to decide which response wins.
  const acceptedGame = useRef<OnlineGame | null>(null);
  const acceptedClock = useRef<ServerClockSample | null>(null);
  const nextLoadId = useRef(0);
  const lastAppliedLoadId = useRef(0);
  const lastAudiblePly = useRef<number | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const syncSound = () => setSound(moveSoundsEnabled());
    queueMicrotask(syncSound);
    window.addEventListener("rookline:preferences-changed", syncSound);
    return () => window.removeEventListener("rookline:preferences-changed", syncSound);
  }, []);

  const load = useCallback(async () => {
    const loadId = ++nextLoadId.current;
    try {
      const response = await fetch(`/api/games/${id}`, { cache: "no-store" });
      const data = await response.json();
      const receivedAt = performance.now();
      // Polling and realtime hints may complete out of order. An obsolete 403
      // must not replace a room already joined in a more recent response.
      if (loadId < lastAppliedLoadId.current) return;
      lastAppliedLoadId.current = loadId;
      if (response.status === 401) {
        acceptedGame.current = null; acceptedClock.current = null;
        setUnauthenticated(true); setJoinable(false); setGame(null);
      } else if (response.status === 403 && data.joinable) {
        acceptedGame.current = null; acceptedClock.current = null;
        setJoinable(true); setGame(null); setUnauthenticated(false);
      } else if (!response.ok) {
        setError(data.error ?? "Could not load the game.");
      } else {
        // A newer request can still return a stale database snapshot. Reject
        // its clock hint alongside its board, result and lifecycle state.
        if (acceptedGame.current && isOlderGameSnapshot(acceptedGame.current, data.game)) return;
        acceptedGame.current = data.game;
        setGame(data.game);
        if (typeof data.serverNow === "number" && Number.isSafeInteger(data.serverNow)) {
          const next = reconcileServerClockSample(acceptedClock.current, { serverNow: data.serverNow, receivedAt });
          if (next !== acceptedClock.current) {
            acceptedClock.current = next;
            setClockSync(next);
            setNow(receivedAt);
          }
        }
        setViewer(data.viewerColor);
        setJoinable(false); setUnauthenticated(false); setError("");
      }
    } catch {
      if (loadId >= lastAppliedLoadId.current) setError("Connection lost. Game state will reload when you reconnect.");
    }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const interval = window.setInterval(() => void load(), 3000);
    const tick = window.setInterval(() => setNow(performance.now()), 250);
    const client = browserSupabase();
    // Realtime is a wakeup signal only. All visual state is refetched from the authoritative API.
    const channel = client?.channel(`rookline-room-${id}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}`,
    }, () => void load()).subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval); window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [id, load]);

  const position = useMemo(() => {
    if (!game) return { chess: new Chess(), valid: true };
    try { return { chess: replayGame(game), valid: true }; }
    catch { return { chess: new Chess(), valid: false }; }
  }, [game]);
  useEffect(() => {
    if (!game) { lastAudiblePly.current = null; return; }
    // A broken server PGN/FEN must never ring or advance the audible sequence.
    // React's verified, applied snapshot is the only source for move audio.
    if (!position.valid) return;
    const previousPly = lastAudiblePly.current;
    if (previousPly !== null && game.ply > previousPly) playMoveSound();
    if (previousPly === null || game.ply > previousPly) lastAudiblePly.current = game.ply;
  }, [game, position.valid]);
  const chess = position.chess;
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  const serverNow = estimatedServerTime(clockSync.serverNow, clockSync.receivedAt, now);
  const clocks = game ? displayedClock(game, serverNow) : { w: 0, b: 0 };
  const myTurn = !!game && game.status === "active" && game.turn === viewer && position.valid;
  const drawClaims = availableDrawClaims(chess);
  const orientation = (flipped ? viewer === "w" ? "black" : "white" : viewer === "b" ? "black" : "white") as "white" | "black";

  async function action(kind: "join" | "resign" | "cancel") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/games/${id}/${kind}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Request failed."); }
    finally { setBusy(false); }
  }

  async function makeMove(from: Square, to: Square, piece?: Promotion) {
    if (!myTurn || busy || !game) return;
    if (!piece && selectPromotion(chess, from, to)) { setPromotion({ from, to }); return; }
    const legal = chess.moves({ square: from, verbose: true }).some((move) => move.to === to && (move.promotion ?? null) === (piece ?? null));
    if (!legal) { setSelected(null); return; }
    setBusy(true); setError(""); setSelected(null); setPromotion(null);
    try {
      const response = await fetch(`/api/games/${id}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, promotion: piece, expectedPly: game.ply, requestId: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Move rejected.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Move failed. Reload game state.");
      await load();
    } finally { setBusy(false); }
  }

  async function claimDraw(rule: DrawClaim) {
    if (!myTurn || busy || !game || !drawClaims[rule]) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/games/${id}/claim`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule, expectedPly: game.ply }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Draw claim rejected.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not claim a draw."); }
    finally { await load(); setBusy(false); }
  }

  const squareClick = (square: string) => {
    if (!myTurn || busy) return;
    const destination = square as Square;
    if (selected && selected !== destination) {
      if (chess.moves({ square: selected, verbose: true }).some((move) => move.to === destination)) { void makeMove(selected, destination); return; }
    }
    setSelected(chess.get(destination)?.color === viewer ? destination : null);
  };

  function submitKeyboardMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!myTurn || busy) return;
    const move = parseCoordinateMove(keyboardMove);
    if (!move) { setKeyboardError("Enter a move like e2e4 or e7e8q."); return; }
    const promotionNeeded = !move.promotion && selectPromotion(chess, move.from, move.to);
    const legal = chess.moves({ square: move.from, verbose: true }).some((candidate) =>
      candidate.to === move.to && (promotionNeeded || (candidate.promotion ?? null) === (move.promotion ?? null)));
    if (!legal) { setKeyboardError("That move is not legal in this position."); return; }
    setKeyboardMove(""); setKeyboardError("");
    void makeMove(move.from, move.to, move.promotion);
  }

  const highlights: Record<string, React.CSSProperties> = {};
  if (last) {
    highlights[last.from] = { boxShadow: "inset 0 0 0 3px var(--color-accent)" };
    highlights[last.to] = { boxShadow: "inset 0 0 0 3px var(--color-accent)" };
  }
  if (selected && myTurn) {
    highlights[selected] = { boxShadow: "inset 0 0 0 3px var(--color-focus)" };
    for (const move of chess.moves({ square: selected, verbose: true })) highlights[move.to] = { backgroundImage: "radial-gradient(circle, var(--color-accent) 19%, transparent 22%)" };
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice("Invite link copied."); }
    catch { setNotice(`Share this page address: ${window.location.href}`); }
  }

  function downloadPgn() {
    if (!game || !position.valid) return;
    try {
      const file = new Blob([exportOnlinePgn(game)], { type: "application/x-chess-pgn" });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rookline-online-${id}.pgn`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export the verified game ledger.");
    }
  }

  if (loading) return <p role="status" className="status">Loading authoritative game state…</p>;
  if (unauthenticated) return <div className="text-panel stack"><h1 className="page-title">Sign in to join this board.</h1><div className="game-actions"><Link className="btn primary" href={`/login?next=${encodeURIComponent(`/game/${id}`)}`}>Sign in</Link><Link className="btn ghost" href={`/register?next=${encodeURIComponent(`/game/${id}`)}`}>Create account</Link></div></div>;
  if (joinable) return <div className="text-panel stack"><h1 className="page-title">You’ve been invited.</h1><p className="muted">Join this private game as Black. Only two accounts can take a seat.</p><button className="btn primary" disabled={busy} type="button" onClick={() => void action("join")}>{busy ? "Joining…" : "Accept challenge"}</button>{error && <p role="alert" className="status">{error}</p>}</div>;
  if (!game) return <div className="text-panel stack"><h1 className="page-title">Game unavailable</h1><p role="alert">{error || "This game was not found or you do not have access."}</p><Link className="btn ghost" href="/play/online">Back to online games</Link></div>;
  if (!position.valid) return <p role="alert" className="status">Server game ledger could not be verified. Stop play and contact support.</p>;

  const top = orientation === "white" ? "b" : "w";
  const bottom = orientation === "white" ? "w" : "b";
  const playerStrip = (color: Viewer) => <div className="player-strip"><span className="player-name"><span className="player-avatar" aria-hidden="true">{color === "w" ? "♙" : "♟"}</span>{color === viewer ? "You" : color === "w" ? "White opponent" : game.black_id ? "Black opponent" : "Waiting for Black"}</span><span className={`clock ${game.status === "active" && game.turn === color ? "running" : ""}`} aria-label={`${color === "w" ? "White" : "Black"} clock`}>{clockLabel(clocks[color])}</span></div>;

  return <section className="stack" onPointerDownCapture={unlockMoveAudio} onKeyDownCapture={unlockMoveAudio}>
    <div><p className="overline">Private online chess · Unrated</p><h1 className="page-title">Your game room</h1><p className="muted">{game.status === "waiting" ? "Invite an opponent to begin." : game.status === "active" ? `${game.turn === viewer ? "Your turn" : "Opponent’s turn"} · ${game.ply} half-moves played` : game.status === "cancelled" ? "Challenge cancelled" : `Game finished · ${game.result ?? "Finished"}`}</p></div>
    <div className="game-grid"><section className="board-shell" aria-label="Online chess game">
      {playerStrip(top)}
      <div className="board-wrap"><Chessboard options={{ id: `rookline-online-${id}`, position: game.fen, boardOrientation: orientation,
        lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" }, squareStyles: highlights,
        boardStyle: { width: "100%", height: "100%" }, animationDurationInMs: 180,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (targetSquare && myTurn && !busy) void makeMove(sourceSquare as Square, targetSquare as Square);
          // The server commits first; the board updates with the returned canonical position.
          return false;
        },
        onSquareClick: ({ square }) => squareClick(square),
      }} /></div>
      {playerStrip(bottom)}
    </section><aside className="game-panel" aria-label="Online game controls">
      <div><h2 className="panel-title">Match details</h2><p className="panel-sub">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · {game.rated ? "Rated" : "Unrated"} · Playing {viewer === "w" ? "White" : "Black"}</p></div>
      <p role="status" className="status">{game.status === "waiting" ? "Waiting for opponent. Share this game link." : game.status === "active" ? busy ? "Saving move…" : myTurn ? "Your move" : "Waiting for opponent’s move" : game.status === "cancelled" ? "This invitation can no longer be accepted." : `Result: ${game.result ?? game.status}`}</p>
      <div className="moves" aria-label="Move history">{history.length === 0 ? <p className="panel-sub">Moves will appear here once your game starts.</p> : Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => <div className="move-row" key={index}><span>{index + 1}.</span><strong>{history[index * 2]?.san}</strong><strong>{history[index * 2 + 1]?.san ?? ""}</strong></div>)}</div>
      <form className="keyboard-move-form" onSubmit={submitKeyboardMove}>
        <label className="panel-sub" htmlFor="online-keyboard-move">Keyboard move · e2e4 or e7e8q</label>
        <div className="keyboard-move-row"><input id="online-keyboard-move" value={keyboardMove} onChange={(event) => { setKeyboardMove(event.target.value); setKeyboardError(""); }} disabled={!myTurn || busy} maxLength={12} autoComplete="off" placeholder="e2e4" /><button className="btn ghost" disabled={!myTurn || busy} type="submit">Move</button></div>
        {keyboardError && <p className="panel-sub" role="alert">{keyboardError}</p>}
      </form>
      <div className="game-actions"><button className="btn ghost" type="button" onClick={() => void copyInvite()}><ClipboardCopy size={16} /> Copy link</button><button className="btn ghost" type="button" onClick={downloadPgn}><ArrowDownToLine size={16} /> Export PGN</button>{game.status === "completed" && <Link className="btn primary" href={`/analysis?onlineGame=${encodeURIComponent(game.id)}`}>Analyze game</Link>}<button className="btn ghost" type="button" onClick={() => setFlipped(!flipped)}><ArrowLeftRight size={16} /> Flip</button><button className="btn ghost" type="button" aria-label={sound ? "Mute moves" : "Enable move sounds"} aria-pressed={sound} onClick={() => { setMoveSoundsEnabled(!sound); setSound(!sound); }}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound {sound ? "on" : "off"}</button></div>
      <div className="game-actions"><button ref={syncButtonRef} className="btn ghost" type="button" onClick={() => void load()}>Sync</button>{game.status === "waiting" && viewer === "w" && <button className="btn ghost" disabled={busy} type="button" onClick={() => void action("cancel")}>Cancel challenge</button>}<button className="btn ghost" disabled={busy || game.status !== "active"} type="button" onClick={() => void action("resign")}><Flag size={16} /> Resign</button><Link className="btn ghost" href="/play/online">My games</Link></div>
      <div className="game-actions" aria-label="Draw claim controls"><button className="btn ghost" type="button" disabled={busy || !myTurn || !drawClaims.repetition} onClick={() => void claimDraw("repetition")}>Claim threefold draw</button><button className="btn ghost" type="button" disabled={busy || !myTurn || !drawClaims.fiftyMoves} onClick={() => void claimDraw("fiftyMoves")}>Claim 50-move draw</button></div>
      {error && <p className="status" role="alert">{error}</p>}{notice && <p className="status" role="status">{notice}</p>}
      <p className="panel-sub">Clocks are calculated by the server. Live updates use secure snapshots after each move; polling covers network interruptions.</p>
    </aside></div>
    {promotion && <PromotionDialog fallbackFocusRef={syncButtonRef} onChoose={(piece) => void makeMove(promotion.from, promotion.to, piece)} onCancel={() => setPromotion(null)} />}
  </section>;
}
