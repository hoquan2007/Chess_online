"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, Download, Lightbulb, RotateCcw, Upload } from "lucide-react";
import { evaluatePracticeMove, practiceNextPly, studyPosition, type PracticeSide, type StudyLine } from "@/lib/chess/study";
import { parseCoordinateMove } from "@/lib/chess/rules";
import { mergeStudyCompletions, readStudyCompletions, recordStudyCompletion, studyProgressKey } from "@/lib/chess/study-progress";
import { exportStudyProgress, maxStudyBackupBytes, parseStudyProgress } from "@/lib/chess/study-backup";

export function StudyExplorer({ lines }: { lines: readonly StudyLine[] }) {
  const [selectedId, setSelectedId] = useState(lines[0].id);
  const [ply, setPly] = useState(0);
  const [mode, setMode] = useState<"review" | "practice">("review");
  const [side, setSide] = useState<PracticeSide>("w");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [keyboardMove, setKeyboardMove] = useState("");
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const backupFileRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef<string[]>([]);
  const selected = lines.find((line) => line.id === selectedId) ?? lines[0];
  const chess = useMemo(() => studyPosition(selected.moves, ply), [selected, ply]);
  const finished = mode === "practice" && ply === selected.moves.length;
  const completedKey = `${selected.id}:${side}`;

  useEffect(() => {
    const sync = () => {
      const merged = mergeStudyCompletions(completedRef.current, readStudyCompletions());
      completedRef.current = merged;
      setCompleted(merged);
    };
    queueMicrotask(() => { sync(); setReady(true); });
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === studyProgressKey || event.key === null)) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resetInputs = () => { setKeyboardMove(""); setSelectedSquare(null); setFeedback(""); };
  const choose = (id: string) => { setSelectedId(id); setMode("review"); setPly(0); resetInputs(); };
  const startPractice = (color: PracticeSide) => {
    setMode("practice"); setSide(color); setPly(practiceNextPly(selected, color, 0)); resetInputs();
  };
  const saveCompletion = () => {
    const next = recordStudyCompletion(completedRef.current, completedKey);
    completedRef.current = next;
    setCompleted(next);
  };
  const downloadProgress = () => {
    const latest = mergeStudyCompletions(completedRef.current, readStudyCompletions());
    const url = URL.createObjectURL(new Blob([exportStudyProgress(latest)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rookline-study-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupMessage("Study progress backup downloaded.");
  };
  const importProgress = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      if (file.size > maxStudyBackupBytes) throw new Error("Backup is larger than 64 KB.");
      const imported = parseStudyProgress(await file.text());
      // File reading is asynchronous: preserve newer solves from this tab and others.
      const merged = mergeStudyCompletions(completedRef.current, readStudyCompletions(), imported);
      completedRef.current = merged;
      setCompleted(merged);
      let persisted = true;
      try { localStorage.setItem(studyProgressKey, JSON.stringify(merged)); }
      catch { persisted = false; }
      setBackupMessage(persisted
        ? `Imported study progress: ${merged.length} mastered sides. Existing progress kept.`
        : "Imported into this tab, but device storage is unavailable. Export a backup before closing.");
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Could not read study backup.");
    }
  };
  const attempt = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (mode !== "practice" || finished) return false;
    const result = evaluatePracticeMove(selected, side, ply, { from, to, promotion });
    setSelectedSquare(null);
    if (result.status === "illegal") { setFeedback("Illegal move. Check the squares and try again."); return false; }
    if (result.status === "off-line") { setFeedback("Legal move, but this line uses a different move. Try again or request a hint."); return false; }
    if (result.status !== "correct") return false;
    setPly(result.ply);
    setKeyboardMove("");
    if (result.ply === selected.moves.length) {
      setFeedback(`Line complete! Last move: ${result.san}.`);
      saveCompletion();
    } else setFeedback(`Correct: ${result.san}. Your next move is ready.`);
    return true;
  };
  const submitKeyboardMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const move = parseCoordinateMove(keyboardMove);
    if (!move) { setFeedback("Enter a move such as e2e4 or e7e8q."); return; }
    attempt(move.from, move.to, move.promotion);
  };
  return <div className="study-grid">
    <div className="text-panel stack" aria-label="Study catalogue">
      <h2>Choose a line</h2>
      <div className="stack" style={{ gap: 10 }}>
        {lines.map((line) => <button className={`study-choice ${selected.id === line.id ? "active" : ""}`} type="button"
          key={line.id} aria-pressed={selected.id === line.id} onClick={() => choose(line.id)}>
          <strong>{line.title}</strong><small className="muted">{line.subtitle}</small>
          {completed.some((key) => key.startsWith(`${line.id}:`)) && <small className="muted">Practice completed on this device</small>}
        </button>)}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <p className="panel-sub">Back up mastered openings and lessons to move your progress between devices. Import merges with existing practice.</p>
        <div className="game-actions">
          <button type="button" className="btn ghost" disabled={!ready} onClick={downloadProgress}><Download size={16} /> Export study progress</button>
          <button type="button" className="btn ghost" disabled={!ready} onClick={() => backupFileRef.current?.click()}><Upload size={16} /> Import study progress</button>
        </div>
        <input ref={backupFileRef} type="file" accept=".json,application/json" hidden aria-label="Choose study backup file" onChange={importProgress} />
        {backupMessage && <p className="panel-sub" role="status">{backupMessage}</p>}
      </div>
    </div>
    <section className="stack" aria-labelledby="study-heading">
      <div><p className="overline">Interactive replay</p><h2 id="study-heading" className="panel-title">{selected.title}</h2>
        <p className="muted">{selected.idea}</p></div>
      <div className="game-actions" role="group" aria-label="Study mode">
        <button type="button" className={`btn ${mode === "review" ? "primary" : "ghost"}`} aria-pressed={mode === "review"} onClick={() => { setMode("review"); setPly(0); resetInputs(); }}>Review moves</button>
        <button type="button" className={`btn ${mode === "practice" && side === "w" ? "primary" : "ghost"}`} aria-pressed={mode === "practice" && side === "w"} onClick={() => startPractice("w")}>Practice as White</button>
        <button type="button" className={`btn ${mode === "practice" && side === "b" ? "primary" : "ghost"}`} aria-pressed={mode === "practice" && side === "b"} onClick={() => startPractice("b")}>Practice as Black</button>
      </div>
      <div className="board-wrap" style={{ maxWidth: 600 }} aria-label={`${selected.title} chessboard`}>
        <Chessboard options={{ id: `rookline-study-${selected.id}`, position: chess.fen(), boardOrientation: mode === "practice" && side === "b" ? "black" : "white",
          lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          boardStyle: { width: "100%", height: "100%" }, animationDurationInMs: 180,
          onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && attempt(sourceSquare as Square, targetSquare as Square),
          onSquareClick: ({ square }) => {
            if (mode !== "practice" || finished) return;
            const target = square as Square;
            if (selectedSquare && selectedSquare !== target && attempt(selectedSquare, target)) return;
            const current = new Chess(chess.fen());
            setSelectedSquare(current.get(target)?.color === side ? target : null);
          },
          squareStyles: selectedSquare ? { [selectedSquare]: { boxShadow: "inset 0 0 0 3px var(--color-focus)" } } : {},
        }} />
      </div>
      <div className="text-panel stack" style={{ gap: 14 }}>
        {mode === "practice" ? <>
          <strong>Practice position {ply} / {selected.moves.length}</strong>
          <p className="muted">Play the next {side === "w" ? "White" : "Black"} move from this opening. The other side follows the lesson automatically.</p>
          <form className="stack" onSubmit={submitKeyboardMove} style={{ gap: 7 }}>
            <label className="panel-sub" htmlFor="study-keyboard-move">Keyboard move · e2e4 or g8f6</label>
            <div className="keyboard-move-row"><input id="study-keyboard-move" value={keyboardMove} onChange={(event) => setKeyboardMove(event.target.value)}
              maxLength={12} autoComplete="off" placeholder="e2e4" disabled={finished} />
              <button type="submit" className="btn ghost" disabled={finished}>Move</button></div>
          </form>
          <p role="status" className="status">{feedback || (finished ? "Line complete!" : "Drag a piece, select two squares, or enter coordinates to practice.")}</p>
          <div className="game-actions">
            <button type="button" className="btn ghost" disabled={finished} onClick={() => setFeedback(`Hint: play ${selected.moves[ply]}.`)}><Lightbulb size={16} /> Hint</button>
            <button type="button" className="btn ghost" onClick={() => startPractice(side)}><RotateCcw size={16} /> Retry line</button>
          </div>
          <p className="muted">Mastered {completed.filter((key) => lines.some((line) => key === `${line.id}:${side}`)).length} / {lines.length} lines as {side === "w" ? "White" : "Black"} on this device.{completed.includes(completedKey) ? " This line is mastered." : ""}</p>
        </> : <>
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
        </>}
        <p className="muted"><strong>Remember:</strong> {selected.takeaway}</p>
      </div>
    </section>
  </div>;
}
