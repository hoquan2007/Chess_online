"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowRight, Lightbulb, RotateCcw } from "lucide-react";
import { evaluatePuzzleMove, puzzles } from "@/lib/chess/puzzles";
import { parseCoordinateMove } from "@/lib/chess/rules";

export function PuzzleTrainer() {
  const [active, setActive] = useState(0);
  const [fen, setFen] = useState<string>(puzzles[0].fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState<string[]>([]);
  const [keyboardMove, setKeyboardMove] = useState("");
  const current = puzzles[active];

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("rookline-puzzles") || "[]");
      const allowed = new Set<string>(puzzles.map((item) => item.id));
      queueMicrotask(() => setComplete(Array.isArray(saved)
        ? Array.from(new Set(saved.filter((item): item is string => typeof item === "string" && allowed.has(item))))
        : []));
    } catch { queueMicrotask(() => setComplete([])); }
  }, []);

  const open = (index: number) => {
    setActive(index);
    setFen(puzzles[index].fen);
    setSolved(false);
    setSelected(null);
    setFeedback("");
    setKeyboardMove("");
  };

  const attempt = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (solved) return false;
    const result = evaluatePuzzleMove(current.id, from, to, promotion);
    if (result.status !== "correct") {
      setFeedback(result.status === "illegal"
        ? "That move is not legal in this position. Try another move."
        : "That's a legal move, but there's a stronger tactic. Try again.");
      setSelected(null);
      return false;
    }
    setFen(result.fen);
    setSolved(true);
    setSelected(null);
    setKeyboardMove("");
    setFeedback(`Correct! ${result.san} is the answer.`);
    const next = Array.from(new Set([...complete, current.id]));
    setComplete(next);
    try { localStorage.setItem("rookline-puzzles", JSON.stringify(next)); }
    catch { /* Private browsing or quota restrictions must not block practice. */ }
    return true;
  };

  const submitKeyboardMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseCoordinateMove(keyboardMove);
    if (!parsed) { setFeedback("Use coordinates such as e2e4 or a7a8q."); return; }
    attempt(parsed.from, parsed.to, parsed.promotion);
  };

  return <div className="game-grid">
    <section className="board-shell"><div className="board-wrap"><Chessboard options={{ id: "rookline-puzzle", position: fen, lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
      onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && attempt(sourceSquare as Square, targetSquare as Square),
      onSquareClick: ({ square }) => { const target = square as Square; if (selected && selected !== target && attempt(selected, target)) return; const game = new Chess(current.fen); setSelected(game.get(target)?.color === game.turn() ? target : null); },
      squareStyles: selected ? { [selected]: { boxShadow: "inset 0 0 0 3px var(--color-focus)" } } : {},
    }} /></div></section>
    <aside className="game-panel">
      <p className="overline">Puzzle {active + 1} of {puzzles.length}</p>
      <h2 className="panel-title">{current.title}</h2><p>{current.description}</p>
      <div className="status" role="status">{feedback || "Drag a piece or click two squares to play your answer."}</div>
      <form onSubmit={submitKeyboardMove} className="stack" style={{ gap: 7 }}>
        <label htmlFor="puzzle-keyboard-move" className="panel-sub">Keyboard move · e2e4 or a7a8q</label>
        <div className="keyboard-move-row">
          <input id="puzzle-keyboard-move" value={keyboardMove} onChange={(event) => setKeyboardMove(event.target.value)}
            maxLength={12} autoComplete="off" placeholder="e2e4" disabled={solved} />
          <button type="submit" className="btn ghost" disabled={solved}>Move</button>
        </div>
      </form>
      <div className="pill-group">{puzzles.map((item, index) => <button key={item.id} type="button" aria-label={`Puzzle ${index + 1}`} className={`pill ${active === index ? "active" : ""}`} onClick={() => open(index)}>{index + 1}{complete.includes(item.id) ? " ✓" : ""}</button>)}</div>
      <p className="muted">Solved {complete.length} / {puzzles.length} positions on this device.</p>
      <div className="game-actions" style={{ marginTop: "auto" }}>
        <button type="button" className="btn ghost" onClick={() => setFeedback(current.hint)}><Lightbulb size={16} /> Hint</button>
        <button type="button" className="btn ghost" onClick={() => open(active)}><RotateCcw size={16} /> Retry</button>
        {solved && <button type="button" className="btn primary" onClick={() => open((active + 1) % puzzles.length)}>Next puzzle <ArrowRight size={16} /></button>}
      </div>
    </aside>
  </div>;
}
