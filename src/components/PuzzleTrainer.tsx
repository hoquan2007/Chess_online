"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowRight, Lightbulb, RotateCcw } from "lucide-react";
import { evaluatePuzzleMove, nextAdaptivePuzzleIndex, nextPracticePuzzleIndex, puzzleIndicesForTheme, puzzles, puzzleThemes, readPuzzleCompletions, readPuzzlePractice, recordPuzzlePractice, type PuzzlePractice, type PuzzlePracticeEvent, type PuzzleTheme } from "@/lib/chess/puzzles";
import { parseCoordinateMove } from "@/lib/chess/rules";

const completedKey = "rookline-puzzles";
const practiceKey = "rookline-puzzle-practice";

function storedCompletions(): string[] | null {
  try { return readPuzzleCompletions(JSON.parse(localStorage.getItem(completedKey) || "[]")); }
  catch { return null; }
}

function storedPractice(): PuzzlePractice | null {
  try {
    const raw = localStorage.getItem(practiceKey);
    return raw === null ? null : readPuzzlePractice(JSON.parse(raw));
  }
  catch { return null; }
}

export function PuzzleTrainer() {
  const [active, setActive] = useState(0);
  const [fen, setFen] = useState<string>(puzzles[0].fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState<string[]>([]);
  const [keyboardMove, setKeyboardMove] = useState("");
  const [theme, setTheme] = useState<PuzzleTheme>("All");
  const [adaptive, setAdaptive] = useState(false);
  const [practice, setPractice] = useState<PuzzlePractice>({});
  const practiceRef = useRef<PuzzlePractice>({});
  const current = puzzles[active];
  const visible = puzzleIndicesForTheme(theme);

  useEffect(() => {
    const syncFromStorage = (key?: string | null) => {
      // Re-read the current value rather than trusting a queued storage event:
      // another tab may have completed a newer puzzle since it was dispatched.
      if (key === undefined || key === null || key === completedKey) {
        setComplete(storedCompletions() ?? []);
      }
      if (key === undefined || key === null || key === practiceKey) {
        const latest = storedPractice() ?? {};
        practiceRef.current = latest;
        setPractice(latest);
      }
    };
    queueMicrotask(() => syncFromStorage());
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage) syncFromStorage(event.key);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const record = (event: PuzzlePracticeEvent) => {
    // Merge with the most recent cross-tab write before increasing a counter.
    const next = recordPuzzlePractice(storedPractice() ?? practiceRef.current, current.id, event);
    practiceRef.current = next;
    setPractice(next);
    try { localStorage.setItem(practiceKey, JSON.stringify(next)); }
    catch { /* Practice works when storage is disabled. */ }
  };

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
      record("error");
      setFeedback(result.status === "illegal"
        ? "That move is not legal in this position. Try another move."
        : "That's a legal move, but there's a stronger tactic. Try again.");
      setSelected(null);
      return false;
    }
    setFen(result.fen);
    setSolved(true);
    record("solve");
    setSelected(null);
    setKeyboardMove("");
    setFeedback(`Correct! ${result.san} is the answer.`);
    // A second tab can solve a different puzzle while this tab remains open.
    const next = Array.from(new Set([...complete, ...(storedCompletions() ?? []), current.id]));
    setComplete(next);
    try { localStorage.setItem(completedKey, JSON.stringify(next)); }
    catch { /* Private browsing or quota restrictions must not block practice. */ }
    return true;
  };

  const submitKeyboardMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseCoordinateMove(keyboardMove);
    if (!parsed) { setFeedback("Use coordinates such as e2e4 or a7a8q."); return; }
    attempt(parsed.from, parsed.to, parsed.promotion);
  };

  const chooseTheme = (value: PuzzleTheme) => {
    setTheme(value);
    open(adaptive ? nextAdaptivePuzzleIndex(-1, value, complete, practice) : nextPracticePuzzleIndex(-1, value, complete));
  };

  const nextPuzzle = () => open(adaptive
    ? nextAdaptivePuzzleIndex(active, theme, complete, practice)
    : nextPracticePuzzleIndex(active, theme, complete));

  return <div className="game-grid">
    <section className="board-shell"><div className="board-wrap"><Chessboard options={{ id: "rookline-puzzle", position: fen, boardOrientation: current.fen.split(" ")[1] === "b" ? "black" : "white", lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
      onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && attempt(sourceSquare as Square, targetSquare as Square),
      onSquareClick: ({ square }) => { const target = square as Square; if (selected && selected !== target && attempt(selected, target)) return; const game = new Chess(current.fen); setSelected(game.get(target)?.color === game.turn() ? target : null); },
      squareStyles: selected ? { [selected]: { boxShadow: "inset 0 0 0 3px var(--color-focus)" } } : {},
    }} /></div></section>
    <aside className="game-panel">
      <p className="overline">Puzzle {active + 1} of {puzzles.length} · {current.theme} · Level {current.level}</p>
      <h2 className="panel-title">{current.title}</h2><p>{current.description}</p>
      <div className="status" role="status">{feedback || "Drag a piece or click two squares to play your answer."}</div>
      <label className="stack" htmlFor="puzzle-topic" style={{ gap: 7 }}>
        <span className="panel-sub">Practice topic</span>
        <select className="field" id="puzzle-topic" value={theme} onChange={(event) => chooseTheme(event.target.value as PuzzleTheme)}>
          {puzzleThemes.map((item) => <option key={item} value={item}>{item === "All" ? "All topics" : item}</option>)}
        </select>
      </label>
      <div className="stack" style={{ gap: 5 }}>
        <button type="button" className={`btn ${adaptive ? "primary" : "ghost"}`} aria-pressed={adaptive}
          onClick={() => { const enabled = !adaptive; setAdaptive(enabled); open(enabled
            ? nextAdaptivePuzzleIndex(-1, theme, complete, practice)
            : nextPracticePuzzleIndex(-1, theme, complete)); }}>
          Adaptive review {adaptive ? "on" : "off"}
        </button>
        <p className="panel-sub">Adaptive review revisits positions you missed or needed hints for. Practice history stays on this device.</p>
      </div>
      <form onSubmit={submitKeyboardMove} className="stack" style={{ gap: 7 }}>
        <label htmlFor="puzzle-keyboard-move" className="panel-sub">Keyboard move · e2e4 or a7a8q</label>
        <div className="keyboard-move-row">
          <input id="puzzle-keyboard-move" value={keyboardMove} onChange={(event) => setKeyboardMove(event.target.value)}
            maxLength={12} autoComplete="off" placeholder="e2e4" disabled={solved} />
          <button type="submit" className="btn ghost" disabled={solved}>Move</button>
        </div>
      </form>
      <div className="pill-group">{visible.map((index) => <button key={puzzles[index].id} type="button" aria-label={`Puzzle ${index + 1}`} aria-pressed={active === index} className={`pill ${active === index ? "active" : ""}`} onClick={() => open(index)}>{index + 1}{complete.includes(puzzles[index].id) ? " ✓" : ""}</button>)}</div>
      <p className="muted">Solved {complete.length} / {puzzles.length} positions on this device.</p>
      <p className="panel-sub">{theme === "All" ? "All topics" : theme}: {visible.filter((index) => complete.includes(puzzles[index].id)).length} / {visible.length} solved.</p>
      <div className="game-actions" style={{ marginTop: "auto" }}>
        <button type="button" className="btn ghost" onClick={() => { if (!solved) record("hint"); setFeedback(current.hint); }}><Lightbulb size={16} /> Hint</button>
        <button type="button" className="btn ghost" onClick={() => open(active)}><RotateCcw size={16} /> Retry</button>
        {solved && <button type="button" className="btn primary" onClick={nextPuzzle}>Next puzzle <ArrowRight size={16} /></button>}
      </div>
    </aside>
  </div>;
}
