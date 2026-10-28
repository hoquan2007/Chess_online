"use client";
/* eslint-disable react-hooks/refs -- Chess.js has an imperative move API; all mutations are event-driven and call sync() to publish a reactive FEN. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowDownToLine, ArrowLeftRight, RotateCcw, Undo2, Volume2, VolumeX, Flag } from "lucide-react";
import { applyLegalMove, availableDrawClaims, gameResult, pgnDownload, restoreLocalGame, selectPromotion, timeoutResult } from "@/lib/chess/rules";
import type { Difficulty } from "@/lib/chess/bot";

type Side = "w" | "b";
type Control = "3+2" | "5+0" | "10+0";
type Clocks = { w: number; b: number };

const controlValues: Record<Control, { base: number; increment: number }> = {
  "3+2": { base: 180, increment: 2 },
  "5+0": { base: 300, increment: 0 },
  "10+0": { base: 600, increment: 0 },
};

function clockText(value: number) {
  const safe = Math.max(0, Math.ceil(value));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

function storeFinishedGame(id: string, game: Chess, outcome: string, mode: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("rookline-history") || "[]");
    const existing = Array.isArray(parsed) ? parsed.filter((item): item is { id: string } =>
      typeof item === "object" && item !== null && typeof item.id === "string") : [];
    const data = { id, pgn: game.pgn(), outcome, mode, date: new Date().toISOString() };
    localStorage.setItem("rookline-history", JSON.stringify([data, ...existing.filter((record) => record.id !== id)].slice(0, 80)));
  } catch {
    // Corrupt data, private browsing restrictions or storage quota must not interrupt a game.
  }
}

export function GameWorkspace({ mode = "local" }: { mode?: "local" | "computer" }) {
  const engine = useRef(new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [playingSide, setPlayingSide] = useState<Side>("w");
  const [control, setControl] = useState<Control>("5+0");
  const [level, setLevel] = useState<Difficulty>("medium");
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [manualResult, setManualResult] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<Clocks>({ w: 300, b: 300 });
  const clockRef = useRef<Clocks>({ w: 300, b: 300 });
  const [undoClocks, setUndoClocks] = useState<Clocks[]>([]);
  const [running, setRunning] = useState(false);
  const [botError, setBotError] = useState("");
  const [sound, setSound] = useState(false);
  const [gameId, setGameId] = useState("local-0");
  const requestId = useRef(0);
  const tickAt = useRef(0);

  const game = engine.current;
  const history = game.history({ verbose: true });
  const lastMove = history.at(-1);
  const computed = gameResult(game);
  const drawClaims = availableDrawClaims(game);
  const timedOut = seconds.w <= 0 ? timeoutResult(game, "w") : seconds.b <= 0 ? timeoutResult(game, "b") : null;
  const outcome = manualResult ?? (computed.finished ? computed.label : null) ?? (timedOut ? timedOut.label : null);
  const botTurn = mode === "computer" && game.turn() !== playingSide;

  const sync = useCallback(() => {
    setFen(engine.current.fen());
    setSelected(null);
    tickAt.current = Date.now();
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const value = localStorage.getItem(`rookline-session-${mode}`);
        if (value) {
          const snapshot = JSON.parse(value) as { pgn: string; control: Control; seconds: Clocks; manualResult: string | null; orientation: "white" | "black"; playingSide: Side; gameId: string; undoClocks?: Clocks[] };
          if (!snapshot || typeof snapshot.pgn !== "string" || snapshot.pgn.length > 100000 ||
              !(snapshot.control in controlValues) || !snapshot.seconds ||
              !["w", "b"].every((side) => Number.isFinite(snapshot.seconds[side as Side]) && snapshot.seconds[side as Side] >= 0 && snapshot.seconds[side as Side] <= 36000) ||
              !["white", "black"].includes(snapshot.orientation) || !["w", "b"].includes(snapshot.playingSide) ||
              typeof snapshot.gameId !== "string" || !snapshot.gameId.startsWith("local-") || snapshot.gameId.length > 80 ||
              (snapshot.undoClocks !== undefined && (!Array.isArray(snapshot.undoClocks) || snapshot.undoClocks.length > 10000 ||
                snapshot.undoClocks.some((clock) => !clock || !["w", "b"].every((side) =>
                  Number.isFinite(clock[side as Side]) && clock[side as Side] >= 0 && clock[side as Side] <= 36000)))) ||
              (snapshot.manualResult !== null && (typeof snapshot.manualResult !== "string" || snapshot.manualResult.length > 160))) {
            throw new Error("Invalid local game snapshot");
          }
          const restored = restoreLocalGame(snapshot.pgn);
          if (snapshot.undoClocks && snapshot.undoClocks.length !== restored.history().length) {
            throw new Error("Inconsistent clock history");
          }
          engine.current = restored;
          setControl(snapshot.control);
          setSeconds(snapshot.seconds);
          clockRef.current = snapshot.seconds;
          setUndoClocks(snapshot.undoClocks ?? []);
          setManualResult(snapshot.manualResult);
          setOrientation(snapshot.orientation);
          setPlayingSide(snapshot.playingSide);
          setGameId(snapshot.gameId);
          setRunning(false);
          sync();
        } else {
          setGameId(`local-${Date.now()}`);
        }
        setSound(localStorage.getItem("rookline-sound") === "on");
      } catch {
        engine.current = new Chess();
        clockRef.current = { w: 300, b: 300 };
        setSeconds(clockRef.current);
        setUndoClocks([]);
        setGameId(`local-${Date.now()}`);
        sync();
      }
    });
    return () => { cancelled = true; };
  }, [mode, sync]);

  useEffect(() => {
    if (gameId === "local-0") return;
    try {
      localStorage.setItem(`rookline-session-${mode}`, JSON.stringify({ pgn: engine.current.pgn(), control, seconds, undoClocks, manualResult, orientation, playingSide, gameId }));
    } catch { /* Game remains playable if browser storage is unavailable. */ }
  }, [fen, mode, control, seconds, undoClocks, manualResult, orientation, playingSide, gameId]);

  useEffect(() => {
    if (!running || outcome || !history.length) return;
    tickAt.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - tickAt.current) / 1000;
      tickAt.current = now;
      const turn = engine.current.turn();
      setSeconds((prev) => {
        const updated = { ...prev, [turn]: Math.max(0, prev[turn] - elapsed) };
        clockRef.current = updated;
        return updated;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [fen, running, outcome, history.length]);

  useEffect(() => {
    if (!outcome || gameId === "local-0") return;
    storeFinishedGame(gameId, engine.current, outcome, mode);
  }, [outcome, gameId, mode]);

  const beep = () => {
    if (!sound) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 480;
      gain.gain.setValueAtTime(.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .08);
      oscillator.onended = () => void context.close();
    } catch { /* Sound can be unavailable in headless browsers. */ }
  };

  const completeMove = useCallback((from: Square, to: Square, promotion?: "q" | "r" | "b" | "n", byBot = false) => {
    if (outcome || (!byBot && botTurn)) return false;
    const before = engine.current.turn();
    if (!promotion && selectPromotion(engine.current, from, to)) {
      if (!byBot) setPendingPromotion({ from, to });
      return false;
    }
    const played = applyLegalMove(engine.current, { from, to, promotion });
    if (!played) return false;
    const beforeClocks = { ...clockRef.current };
    setUndoClocks((previous) => [...previous, beforeClocks]);
    const afterClocks = { ...beforeClocks, [before]: beforeClocks[before] + controlValues[control].increment };
    clockRef.current = afterClocks;
    setSeconds(afterClocks);
    setRunning(true);
    setPendingPromotion(null);
    sync();
    return true;
  }, [outcome, botTurn, sync, control]);

  useEffect(() => {
    if (mode !== "computer" || !botTurn || outcome || botError || gameId === "local-0") return;
    const worker = new Worker(new URL("../workers/chess-bot.worker.ts", import.meta.url));
    const request = ++requestId.current;
    worker.onmessage = (event: MessageEvent<{ request: number; move?: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }; error?: string }>) => {
      if (event.data.request !== request || requestId.current !== request) return;
      if (event.data.error) { setBotError(event.data.error); return; }
      if (event.data.move) completeMove(event.data.move.from, event.data.move.to, event.data.move.promotion, true);
    };
    worker.onerror = () => setBotError("Computer engine could not start. Reset to retry.");
    worker.postMessage({ request, pgn: game.pgn(), level });
    const outstandingRequest = requestId;
    return () => { outstandingRequest.current++; worker.terminate(); };
  }, [fen, mode, botTurn, outcome, level, completeMove, botError, gameId, game]);

  const trySquare = (square: string) => {
    if (outcome || botTurn) return;
    const destination = square as Square;
    if (selected && selected !== destination && completeMove(selected, destination)) { beep(); return; }
    const piece = game.get(destination);
    setSelected(piece?.color === game.turn() ? destination : null);
  };

  const highlighted = (() => {
    const result: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      result[lastMove.from] = { boxShadow: "inset 0 0 0 3px var(--color-accent)" };
      result[lastMove.to] = { boxShadow: "inset 0 0 0 3px var(--color-accent)" };
    }
    if (selected) {
      result[selected] = { boxShadow: "inset 0 0 0 4px var(--color-focus)" };
      for (const move of engine.current.moves({ square: selected, verbose: true })) {
        result[move.to] = { backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 52%, transparent) 22%, transparent 25%)" };
      }
    }
    return result;
  })();

  const reset = () => {
    requestId.current++;
    engine.current = new Chess();
    setManualResult(null);
    setBotError("");
    clockRef.current = { w: controlValues[control].base, b: controlValues[control].base };
    setSeconds(clockRef.current);
    setUndoClocks([]);
    setRunning(false);
    setGameId(`local-${Date.now()}`);
    sync();
  };

  const undo = () => {
    if (game.history().length === 0) return;
    requestId.current++;
    engine.current.undo();
    let undone = 1;
    if (mode === "computer" && engine.current.history().length > 0 && engine.current.turn() !== playingSide) {
      engine.current.undo();
      undone++;
    }
    const previousClocks = undoClocks.at(-undone);
    if (previousClocks) {
      clockRef.current = previousClocks;
      setSeconds(previousClocks);
    }
    setUndoClocks((previous) => previous.slice(0, -undone));
    setManualResult(null);
    setBotError("");
    setRunning(false);
    sync();
  };

  const downloadPgn = () => {
    const file = new Blob([pgnDownload(game)], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rookline-game.pgn";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const claimDraw = () => {
    if (outcome) return;
    const available = availableDrawClaims(engine.current);
    if (!available.repetition && !available.fiftyMoves) return;
    setManualResult(available.repetition ? "Draw: claimed threefold repetition" : "Draw: claimed fifty-move rule");
    setRunning(false);
  };

  const toggleSound = () => {
    localStorage.setItem("rookline-sound", sound ? "off" : "on");
    setSound(!sound);
  };

  const sideName = (color: Side) => mode === "computer" ? color === playingSide ? "You" : `Computer (${level})` : color === "w" ? "White player" : "Black player";
  const renderPlayer = (color: Side) => (
    <div className="player-strip" key={color}>
      <span className="player-name"><span className="player-avatar" aria-hidden="true">{color === "w" ? "♙" : "♟"}</span>{sideName(color)}</span>
      <span className={`clock ${running && game.turn() === color && !outcome ? "running" : ""}`} aria-label={`${color === "w" ? "White" : "Black"} clock`}>{clockText(seconds[color])}</span>
    </div>
  );

  return (
    <div className="game-grid">
      <section className="board-shell" aria-label="Chess game">
        {renderPlayer(orientation === "white" ? "b" : "w")}
        <div className="board-wrap">
          <Chessboard options={{
            id: `rookline-${mode}`, position: fen, boardOrientation: orientation,
            lightSquareStyle: { backgroundColor: "var(--board-light)" },
            darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            squareStyles: highlighted,
            boardStyle: { width: "100%", height: "100%" },
            animationDurationInMs: 180,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false;
              const succeeded = completeMove(sourceSquare as Square, targetSquare as Square);
              if (succeeded) beep();
              return succeeded;
            },
            onSquareClick: ({ square }) => trySquare(square),
          }} />
        </div>
        {renderPlayer(orientation === "white" ? "w" : "b")}
      </section>
      <aside className="game-panel" aria-label="Game controls">
        <div><h2 className="panel-title">{mode === "computer" ? "Computer match" : "Local chess"}</h2><p className="panel-sub">{mode === "computer" ? "Practice at your own pace" : "Play together on one board"}</p></div>
        <div className="status" role="status">{outcome ?? (botTurn ? "Computer is thinking…" : computed.label === "Check" ? "Check — protect your king" : `${game.turn() === "w" ? "White" : "Black"} to move`)}</div>
        <div><p className="panel-sub">Time control</p><div className="pill-group" style={{ marginTop: "var(--space-xs)" }}>{(Object.keys(controlValues) as Control[]).map((value) => <button type="button" key={value} disabled={history.length > 0} onClick={() => { setControl(value); clockRef.current = { w: controlValues[value].base, b: controlValues[value].base }; setSeconds(clockRef.current); }} className={`pill ${value === control ? "active" : ""}`}>{value}</button>)}</div></div>
        {mode === "computer" && <>
          <div><p className="panel-sub">Computer strength</p><div className="pill-group" style={{ marginTop: "var(--space-xs)" }}>{(["easy", "medium", "hard", "advanced"] as Difficulty[]).map((value) => <button type="button" key={value} className={`pill ${level === value ? "active" : ""}`} onClick={() => setLevel(value)}>{value}</button>)}</div></div>
          <div><p className="panel-sub">Play as</p><div className="pill-group" style={{ marginTop: "var(--space-xs)" }}>{(["w", "b"] as Side[]).map((side) => <button type="button" key={side} disabled={history.length > 0} className={`pill ${playingSide === side ? "active" : ""}`} onClick={() => { setPlayingSide(side); setOrientation(side === "w" ? "white" : "black"); }}>{side === "w" ? "White" : "Black"}</button>)}</div></div>
        </>}
        <div className="moves" aria-label="Move history">
          {history.length === 0 ? <p className="panel-sub">Your moves will appear here. Drag a piece or click a square.</p> : Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => <div className="move-row" key={i}><span>{i + 1}.</span><strong>{history[i * 2]?.san ?? ""}</strong><strong>{history[i * 2 + 1]?.san ?? ""}</strong></div>)}
        </div>
        {botError && <p className="status" role="alert">{botError}</p>}
        <div className="game-actions">
          <button type="button" className="btn ghost" onClick={undo} disabled={history.length === 0}><Undo2 size={16} /> Undo</button>
          <button type="button" className="btn ghost" onClick={() => setOrientation((prev) => prev === "white" ? "black" : "white")}><ArrowLeftRight size={16} /> Flip</button>
          <button type="button" className="icon-btn" aria-label={sound ? "Mute moves" : "Enable move sounds"} title="Move sound" onClick={toggleSound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button type="button" className="btn ghost" onClick={downloadPgn}><ArrowDownToLine size={16} /> PGN</button>
        </div>
        <div className="game-actions">
          <button type="button" className="btn primary" onClick={reset}><RotateCcw size={16} /> New game</button>
          <button type="button" className="btn ghost" disabled={!!outcome || (!drawClaims.repetition && !drawClaims.fiftyMoves)} onClick={claimDraw}>Claim draw</button>
          <button type="button" className="btn ghost" disabled={!!outcome || history.length === 0} onClick={() => { setManualResult(`${game.turn() === "w" ? "White" : "Black"} resigned`); setRunning(false); }}><Flag size={16} /> Resign</button>
        </div>
      </aside>
      {pendingPromotion && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose a promotion piece">
        <div className="promotion-box"><h2>Choose your promotion</h2><div className="promotion-choices">{(["q", "r", "b", "n"] as const).map((piece) => <button key={piece} type="button" aria-label={`Promote to ${piece === "q" ? "queen" : piece === "r" ? "rook" : piece === "b" ? "bishop" : "knight"}`} onClick={() => { completeMove(pendingPromotion.from, pendingPromotion.to, piece); beep(); }}>{({ q: "♛", r: "♜", b: "♝", n: "♞" })[piece]}</button>)}</div><button className="btn ghost" type="button" onClick={() => setPendingPromotion(null)}>Cancel</button></div>
      </div>}
    </div>
  );
}
