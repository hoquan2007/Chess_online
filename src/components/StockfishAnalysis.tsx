"use client";

import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { formatStockfishScore, legalStockfishVariation, parseStockfishInfo, type StockfishLine } from "@/lib/chess/stockfish";

type EngineResult = NonNullable<ReturnType<typeof legalStockfishVariation>>;
type EngineState = { key: string; phase: "loading" | "thinking" | "done" | "error"; lines: EngineResult[]; error?: string };

/** Stockfish runs only in the visitor's browser and never influences rated play. */
export function StockfishAnalysis({ fen, positionKey, onTry }: {
  fen: string;
  positionKey: string;
  onTry: (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => void;
}) {
  const [state, setState] = useState<EngineState | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  useEffect(() => () => {
    requestRef.current++;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, [positionKey]);

  const analyze = () => {
    workerRef.current?.terminate();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const request = ++requestRef.current;
    let turn: "w" | "b";
    try { turn = new Chess(fen).turn(); }
    catch { setState({ key: positionKey, phase: "error", lines: [], error: "Invalid position." }); return; }
    setState({ key: positionKey, phase: "loading", lines: [] });

    try {
      const worker = new Worker("/engine/stockfish-19-lite-single.js");
      workerRef.current = worker;
      const current = new Map<number, StockfishLine>();
      let initialized = false;
      let searching = false;
      const settle = (error?: string) => {
        if (request !== requestRef.current) return;
        requestRef.current++;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        const lines = [...current.values()]
          .map((line) => legalStockfishVariation(fen, line))
          .filter((line): line is EngineResult => line !== null)
          .sort((a, b) => a.multipv - b.multipv);
        setState({ key: positionKey, phase: error || !lines.length ? "error" : "done", lines,
          error: error ?? (lines.length ? undefined : "Stockfish did not return a legal variation.") });
      };

      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (request !== requestRef.current || typeof event.data !== "string") return;
        for (const raw of event.data.split(/\r?\n/)) {
          const line = raw.trim();
          if (line === "uciok" && !initialized) {
            initialized = true;
            worker.postMessage("setoption name MultiPV value 3");
            worker.postMessage("isready");
          } else if (line === "readyok" && initialized && !searching) {
            searching = true;
            setState({ key: positionKey, phase: "thinking", lines: [] });
            worker.postMessage(`position fen ${fen}`);
            worker.postMessage("go depth 14 movetime 5000");
          } else if (line.startsWith("info ") && searching) {
            const parsed = parseStockfishInfo(line, turn);
            if (parsed && legalStockfishVariation(fen, parsed)) {
              const previous = current.get(parsed.multipv);
              if (!previous || parsed.depth >= previous.depth) current.set(parsed.multipv, parsed);
            }
          } else if (/^bestmove\s/.test(line) && searching) {
            settle();
            return;
          }
        }
      };
      worker.onerror = () => settle("Stockfish could not start on this device.");
      worker.onmessageerror = () => settle("Engine message could not be decoded.");
      worker.postMessage("uci");
      timeoutRef.current = setTimeout(() => settle("Stockfish exceeded the 25-second analysis limit."), 25_000);
    } catch {
      requestRef.current++;
      setState({ key: positionKey, phase: "error", lines: [], error: "This browser cannot run the engine." });
    }
  };

  const visible = state?.key === positionKey ? state : null;
  return <section aria-label="Stockfish engine analysis" className="stack" style={{ gap: 8 }}>
    <h3 className="panel-sub">Stockfish 19 · chess engine</h3>
    <p className="panel-sub">Analyze this position with Stockfish 19 Lite, a strong UCI engine running locally in your browser. Evaluation is from White&apos;s perspective. Engine suggestions are never used to settle online games.</p>
    <button type="button" className="btn ghost" onClick={analyze} disabled={visible?.phase === "loading" || visible?.phase === "thinking"}>Analyze with Stockfish 19</button>
    <div aria-live="polite" aria-atomic="true">
      {visible?.phase === "loading" && <p className="status">Loading Stockfish engine…</p>}
      {visible?.phase === "thinking" && <p className="status">Stockfish is evaluating this position…</p>}
      {visible?.error && <p className="status">{visible.error}</p>}
      {visible?.phase === "done" && <p className="status">Engine analysis complete.</p>}
    </div>
    {visible?.phase === "done" && <ol aria-label="Stockfish variations" className="stack" style={{ gap: 8, paddingLeft: 24 }}>
      {visible.lines.map((line) => <li key={line.multipv}>
        <strong>{line.first.san}</strong> · {formatStockfishScore(line.score)} · depth {line.depth}
        <p className="muted">{line.san.slice(0, 6).join(" ")}</p>
        <button type="button" className="btn ghost" aria-label={`Try Stockfish move ${line.first.san}`} onClick={() => onTry(line.first.from, line.first.to, line.first.promotion)}>Try move</button>
      </li>)}
    </ol>}
    <p className="panel-sub">Stockfish.js © its contributors · <a href="/engine/COPYING.txt" target="_blank" rel="noreferrer">GPL-3.0 license</a> · <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1" target="_blank" rel="noreferrer">Engine source</a>.</p>
  </section>;
}
