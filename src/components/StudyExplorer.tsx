"use client";

import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { studyPosition, type StudyLine } from "@/lib/chess/study";

export function StudyExplorer({ lines }: { lines: readonly StudyLine[] }) {
  const [selectedId, setSelectedId] = useState(lines[0].id);
  const [ply, setPly] = useState(0);
  const selected = lines.find((line) => line.id === selectedId) ?? lines[0];
  const chess = useMemo(() => studyPosition(selected.moves, ply), [selected, ply]);

  const choose = (id: string) => { setSelectedId(id); setPly(0); };
  return <div className="study-grid">
    <div className="text-panel stack" aria-label="Study catalogue">
      <h2>Choose a line</h2>
      <div className="stack" style={{ gap: 10 }}>
        {lines.map((line) => <button className={`study-choice ${selected.id === line.id ? "active" : ""}`} type="button"
          key={line.id} aria-pressed={selected.id === line.id} onClick={() => choose(line.id)}>
          <strong>{line.title}</strong><small className="muted">{line.subtitle}</small>
        </button>)}
      </div>
    </div>
    <section className="stack" aria-labelledby="study-heading">
      <div><p className="overline">Interactive replay</p><h2 id="study-heading" className="panel-title">{selected.title}</h2>
        <p className="muted">{selected.idea}</p></div>
      <div className="board-wrap" style={{ maxWidth: 600 }} aria-label={`${selected.title} chessboard`}>
        <Chessboard options={{ id: `rookline-study-${selected.id}`, position: chess.fen(),
          lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          boardStyle: { width: "100%", height: "100%" }, animationDurationInMs: 180,
          onPieceDrop: () => false,
        }} />
      </div>
      <div className="text-panel stack" style={{ gap: 14 }}>
        <div className="game-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Position {ply} / {selected.moves.length}</strong>
          <div className="game-actions">
            <button type="button" className="btn ghost" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Restart line"><RotateCcw size={17} /></button>
            <button type="button" className="btn ghost" onClick={() => setPly((current) => Math.max(0, current - 1))} disabled={ply === 0} aria-label="Previous move"><ChevronLeft size={17} /></button>
            <button type="button" className="btn primary" onClick={() => setPly((current) => Math.min(selected.moves.length, current + 1))} disabled={ply === selected.moves.length} aria-label="Next move"><ChevronRight size={17} /> Next</button>
          </div>
        </div>
        <div className="pill-group" aria-label="Line moves">{selected.moves.map((move, index) => <button key={index} type="button"
          aria-label={`Go to move ${index + 1}: ${move}`} aria-current={ply === index + 1 ? "step" : undefined}
          onClick={() => setPly(index + 1)} className={`pill ${ply === index + 1 ? "active" : ""}`}>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ""}{move}</button>)}</div>
        <p role="status" className="status">{ply === 0 ? "Starting position. Select Next to begin." : selected.steps[ply - 1]}</p>
        <p className="muted"><strong>Remember:</strong> {selected.takeaway}</p>
      </div>
    </section>
  </div>;
}
