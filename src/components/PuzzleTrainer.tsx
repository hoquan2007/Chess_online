"use client";

import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowRight, Lightbulb, RotateCcw } from "lucide-react";
import { isPuzzleSolution, puzzles } from "@/lib/chess/puzzles";

export function PuzzleTrainer() {
  const [active, setActive] = useState(0);
  const [fen, setFen] = useState<string>(puzzles[0].fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState<string[]>([]);
  const current = puzzles[active];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rookline-puzzles") || "[]") as string[];
      queueMicrotask(() => setComplete(saved));
    } catch { queueMicrotask(() => setComplete([])); }
  }, []);

  const open = (index: number) => {
    setActive(index);
    setFen(puzzles[index].fen);
    setSolved(false);
    setSelected(null);
    setFeedback("");
  };

  const attempt = (from: Square, to: Square) => {
    if (solved) return false;
    if (!isPuzzleSolution(current.id, from, to)) {
      setFeedback("That's a legal idea to investigate, but there's a stronger tactic. Try again.");
      setSelected(null);
      return false;
    }
    const game = new Chess(current.fen);
    game.move({ from, to, promotion: "q" });
    setFen(game.fen());
    setSolved(true);
    setSelected(null);
    setFeedback(`Correct! ${current.solution} is the answer.`);
    const next = Array.from(new Set([...complete, current.id]));
    setComplete(next);
    localStorage.setItem("rookline-puzzles", JSON.stringify(next));
    return true;
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
