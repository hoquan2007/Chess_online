"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowLeft, ArrowRight, Download, RotateCcw } from "lucide-react";
import { applyLegalMove } from "@/lib/chess/rules";

type Analysis = { start: string; san: string[]; index: number };

export function AnalysisWorkspace({ initialPgn = "" }: { initialPgn?: string }) {
  const [analysis, setAnalysis] = useState<Analysis>(() => ({ start: new Chess().fen(), san: [], index: 0 }));
  const [selected, setSelected] = useState<Square | null>(null);
  const [pgn, setPgn] = useState(initialPgn);
  const [fenText, setFenText] = useState("");
  const [message, setMessage] = useState("");
  const [orientation, setOrientation] = useState<"white" | "black">("white");

  const board = useMemo(() => {
    const reconstructed = new Chess(analysis.start);
    for (const san of analysis.san.slice(0, analysis.index)) reconstructed.move(san);
    return reconstructed;
  }, [analysis]);

  const seek = (step: number) => {
    setAnalysis((prev) => ({ ...prev, index: Math.max(0, Math.min(step, prev.san.length)) }));
    setSelected(null);
  };

  const importPgn = () => {
    try {
      const parsed = new Chess();
      parsed.loadPgn(pgn);
      const history = parsed.history();
      setAnalysis({ start: parsed.header().FEN || new Chess().fen(), san: history, index: history.length });
      setSelected(null);
      setMessage(`${history.length} plies imported successfully.`);
    } catch { setMessage("Invalid PGN. Check the move text and try again."); }
  };

  const loadFen = () => {
    try {
      const parsed = new Chess(fenText.trim());
      setAnalysis({ start: parsed.fen(), san: [], index: 0 });
      setSelected(null);
      setMessage("Position loaded. You can explore legal moves.");
    } catch { setMessage("Invalid FEN. Please enter a legal chess position."); }
  };

  const makeMove = (from: Square, to: Square, promotion: "q" | "r" | "b" | "n" = "q") => {
    const copy = new Chess(analysis.start);
    for (const san of analysis.san.slice(0, analysis.index)) copy.move(san);
    const played = applyLegalMove(copy, { from, to, promotion });
    if (!played) return false;
    const next = [...analysis.san.slice(0, analysis.index), played.san];
    setAnalysis({ ...analysis, san: next, index: next.length });
    setSelected(null);
    setMessage(`Played ${played.san}.`);
    return true;
  };

  const exportPgn = () => {
    const reconstructed = new Chess(analysis.start);
    for (const san of analysis.san) reconstructed.move(san);
    const blob = new Blob([reconstructed.pgn()], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = "rookline-analysis.pgn";
    anchor.href = url;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const lastMove = board.history({ verbose: true }).at(-1);
  const styles: Record<string, React.CSSProperties> = {};
  if (lastMove) styles[lastMove.to] = { boxShadow: "inset 0 0 0 3px var(--color-accent)" };
  if (selected) {
    styles[selected] = { boxShadow: "inset 0 0 0 3px var(--color-focus)" };
    for (const move of board.moves({ square: selected, verbose: true })) styles[move.to] = { backgroundImage: "radial-gradient(circle, var(--color-accent) 0 16%, transparent 18%)" };
  }

  return <div className="game-grid">
    <section className="board-shell" aria-label="Analysis board">
      <div className="board-wrap"><Chessboard options={{ id: "rookline-analysis", position: board.fen(), boardOrientation: orientation, lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" }, squareStyles: styles,
        onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && makeMove(sourceSquare as Square, targetSquare as Square),
        onSquareClick: ({ square }) => {
          const target = square as Square;
          if (selected && selected !== target && makeMove(selected, target)) return;
          setSelected(board.get(target)?.color === board.turn() ? target : null);
        },
      }} /></div>
      <div className="game-actions" style={{ justifyContent: "center", marginTop: "var(--space-sm)" }}>
        <button type="button" className="icon-btn" aria-label="First move" onClick={() => seek(0)}><RotateCcw size={17} /></button>
        <button type="button" className="icon-btn" aria-label="Previous move" onClick={() => seek(analysis.index - 1)} disabled={!analysis.index}><ArrowLeft size={17} /></button>
        <span className="clock">{analysis.index} / {analysis.san.length}</span>
        <button type="button" className="icon-btn" aria-label="Next move" onClick={() => seek(analysis.index + 1)} disabled={analysis.index === analysis.san.length}><ArrowRight size={17} /></button>
        <button type="button" className="btn ghost" onClick={() => setOrientation((prev) => prev === "white" ? "black" : "white")}>Flip</button>
      </div>
    </section>
    <aside className="game-panel">
      <h2 className="panel-title">Explore the position</h2>
      <p className="panel-sub">Import PGN, paste a FEN, or move the pieces. Use the move navigator to replay positions.</p>
      <label className="label">PGN game<textarea className="field" rows={4} value={pgn} onChange={(event) => setPgn(event.target.value)} placeholder="1. e4 e5 2. Nf3 Nc6" /></label>
      <button type="button" className="btn primary" onClick={importPgn}>Import PGN</button>
      <label className="label">FEN position<input className="field" value={fenText} onChange={(event) => setFenText(event.target.value)} placeholder="Paste FEN here" /></label>
      <button type="button" className="btn ghost" onClick={loadFen}>Load FEN</button>
      <div className="moves" aria-label="Analysis moves">
        {analysis.san.length === 0 ? <p className="panel-sub">Move a piece to start a variation.</p> : Array.from({ length: Math.ceil(analysis.san.length / 2) }, (_, i) => <div className="move-row" key={i}><span>{i + 1}.</span>{[0, 1].map((offset) => <button type="button" key={offset} disabled={!analysis.san[i * 2 + offset]} onClick={() => seek(i * 2 + offset + 1)} style={{ textAlign: "left", textDecoration: analysis.index === i * 2 + offset + 1 ? "underline" : "none" }}>{analysis.san[i * 2 + offset] || ""}</button>)}</div>)}
      </div>
      {message && <p className="status" role="status">{message}</p>}
      <div className="game-actions"><button type="button" className="btn ghost" onClick={exportPgn}><Download size={17} /> Export PGN</button><button type="button" className="btn ghost" onClick={() => { setAnalysis({ start: new Chess().fen(), san: [], index: 0 }); setMessage(""); }}>Reset</button></div>
    </aside>
  </div>;
}
