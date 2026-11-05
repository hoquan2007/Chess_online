"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowRight, Download, Lightbulb, RotateCcw, Upload } from "lucide-react";
import { evaluatePuzzleMove, nextAdaptivePuzzleIndex, nextPracticePuzzleIndex, puzzleIndicesForTheme, puzzles, puzzleThemes, readPuzzleCompletions, readPuzzlePractice, recordPuzzlePractice, type PuzzlePractice, type PuzzlePracticeEvent, type PuzzleTheme } from "@/lib/chess/puzzles";
import { exportPuzzleProgress, maxPuzzleBackupBytes, mergePuzzleProgress, parsePuzzleProgress } from "@/lib/chess/puzzle-backup";
import { parseKeyboardMove, selectPromotion } from "@/lib/chess/rules";
import { createLearningCloud } from "@/lib/chess/learning-cloud";
import { browserSupabase } from "@/lib/supabase/client";
import { PromotionDialog } from "@/components/PromotionDialog";

const completedKey = "rookline-puzzles";
const practiceKey = "rookline-puzzle-practice";
const ownerKey = "rookline-learning-owner:puzzle";

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
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState<string[]>([]);
  const [keyboardMove, setKeyboardMove] = useState("");
  const [theme, setTheme] = useState<PuzzleTheme>("All");
  const [adaptive, setAdaptive] = useState(false);
  const [ready, setReady] = useState(false);
  const [practice, setPractice] = useState<PuzzlePractice>({});
  const [backupMessage, setBackupMessage] = useState("");
  const [cloudMessage, setCloudMessage] = useState("Device progress only");
  const cloudRef = useRef<ReturnType<typeof createLearningCloud> | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const completeRef = useRef<string[]>([]);
  const practiceRef = useRef<PuzzlePractice>({});
  const current = puzzles[active];
  const visible = puzzleIndicesForTheme(theme);
  const ownsDeviceProgress = () => cloudRef.current?.ownsDeviceStorage() ?? true;

  useEffect(() => {
    const syncFromStorage = (key?: string | null) => {
      if (!ownsDeviceProgress()) return;
      // Re-read the current value rather than trusting a queued storage event:
      // another tab may have completed a newer puzzle since it was dispatched.
      if (key === undefined || key === null || key === completedKey) {
        const latest = storedCompletions() ?? [];
        completeRef.current = latest;
        setComplete(latest);
      }
      if (key === undefined || key === null || key === practiceKey) {
        const latest = storedPractice() ?? {};
        practiceRef.current = latest;
        setPractice(latest);
      }
    };
    // Keep server-rendered controls disabled until hydration has restored
    // progress. Fast clicks after reload must not select from empty defaults.
    queueMicrotask(() => {
      syncFromStorage();
      setReady(true);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === ownerKey || event.key === null) cloudRef.current?.onOwnerStorageChanged();
      if (event.key !== ownerKey) syncFromStorage(event.key);
    };
    window.addEventListener("storage", onStorage);
    const cloud = createLearningCloud("puzzle", {
      readLocal: () => readPuzzleCompletions([...completeRef.current, ...(storedCompletions() ?? [])]),
      applyMerged: (ids, replace, persist = true) => {
        const merged = readPuzzleCompletions(replace ? ids : [...completeRef.current, ...(storedCompletions() ?? []), ...ids]);
        completeRef.current = merged;
        setComplete(merged);
        if (persist) try { localStorage.setItem(completedKey, JSON.stringify(merged)); } catch { /* device state retained */ }
      },
      onAccountReset: (memoryOnly = false) => {
        // Practice counters are device-local and must not follow a different
        // account on a shared browser even though completions sync to cloud.
        practiceRef.current = {};
        setPractice({});
        if (!memoryOnly) try { localStorage.removeItem(practiceKey); } catch { /* storage unavailable */ }
      },
      onStatus: setCloudMessage,
    });
    cloudRef.current = cloud;
    const { data: authSubscription } = browserSupabase()?.auth.onAuthStateChange((event, session) => cloud.onAuthEvent(event, session?.user.id)) ?? { data: null };
    void cloud.connect();
    return () => { window.removeEventListener("storage", onStorage); authSubscription?.subscription.unsubscribe(); cloud.dispose(); cloudRef.current = null; };
  }, []);

  const record = (event: PuzzlePracticeEvent) => {
    // Merge with the most recent cross-tab write before increasing a counter.
    const next = recordPuzzlePractice((ownsDeviceProgress() ? storedPractice() : null) ?? practiceRef.current, current.id, event);
    practiceRef.current = next;
    setPractice(next);
    try { if (ownsDeviceProgress()) localStorage.setItem(practiceKey, JSON.stringify(next)); }
    catch { /* Practice works when storage is disabled. */ }
  };

  const open = (index: number) => {
    setPendingPromotion(null);
    setActive(index);
    setFen(puzzles[index].fen);
    setStep(0);
    setSolved(false);
    setSelected(null);
    setFeedback("");
    setKeyboardMove("");
  };

  const attempt = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    if (solved) return false;
    if (!promotion && selectPromotion(new Chess(fen), from, to)) {
      setPendingPromotion({ from, to });
      setSelected(null);
      return false;
    }
    setPendingPromotion(null);
    const result = evaluatePuzzleMove(current.id, from, to, promotion, step);
    if (result.status === "continue") {
      setFen(result.fen);
      setStep(step + 1);
      setSelected(null);
      setKeyboardMove("");
      setFeedback(`Correct! ${result.san}. ${current.fen.split(" ")[1] === "b" ? "White" : "Black"} replies ${result.replySan}. Find the finish.`);
      return true;
    }
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
    const next = readPuzzleCompletions([...completeRef.current, ...(ownsDeviceProgress() ? storedCompletions() ?? [] : []), current.id]);
    completeRef.current = next;
    setComplete(next);
    void cloudRef.current?.save(next);
    try { if (ownsDeviceProgress()) localStorage.setItem(completedKey, JSON.stringify(next)); }
    catch { /* Private browsing or quota restrictions must not block practice. */ }
    return true;
  };

  const submitKeyboardMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseKeyboardMove(new Chess(fen), keyboardMove);
    if (!parsed) { setFeedback("Use coordinates such as e2e4 or legal notation such as Qf8+."); return; }
    attempt(parsed.from, parsed.to, parsed.promotion);
  };

  const chooseTheme = (value: PuzzleTheme) => {
    setTheme(value);
    const latestComplete = (ownsDeviceProgress() ? storedCompletions() : null) ?? complete;
    const latestPractice = (ownsDeviceProgress() ? storedPractice() : null) ?? practice;
    open(adaptive ? nextAdaptivePuzzleIndex(-1, value, latestComplete, latestPractice) : nextPracticePuzzleIndex(-1, value, latestComplete));
  };

  const nextPuzzle = () => open(adaptive
    ? nextAdaptivePuzzleIndex(active, theme, complete, practice)
    : nextPracticePuzzleIndex(active, theme, complete));

  const downloadProgress = () => {
    const payload = exportPuzzleProgress({
      completed: readPuzzleCompletions([...completeRef.current, ...(ownsDeviceProgress() ? storedCompletions() ?? [] : [])]),
      practice: mergePuzzleProgress({ completed: [], practice: practiceRef.current }, { completed: [], practice: ownsDeviceProgress() ? storedPractice() ?? {} : {} }).practice,
    });
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rookline-puzzle-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupMessage("Puzzle progress backup downloaded.");
  };

  const importProgress = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Allow choosing the same file again after an invalid import.
    event.currentTarget.value = "";
    if (!file) return;
    try {
      if (file.size > maxPuzzleBackupBytes) throw new Error("Backup is larger than 64 KB.");
      const imported = parsePuzzleProgress(await file.text());
      const merged = mergePuzzleProgress({
        // Re-read refs and device storage after the async file read: playing
        // another puzzle during import must not lose its latest progress.
        completed: readPuzzleCompletions([...completeRef.current, ...(ownsDeviceProgress() ? storedCompletions() ?? [] : [])]),
        practice: mergePuzzleProgress({ completed: [], practice: practiceRef.current }, { completed: [], practice: ownsDeviceProgress() ? storedPractice() ?? {} : {} }).practice,
      }, imported);
      completeRef.current = merged.completed;
      setComplete(merged.completed);
      void cloudRef.current?.save(merged.completed);
      practiceRef.current = merged.practice;
      setPractice(merged.practice);
      let persisted = true;
      try {
        if (!ownsDeviceProgress()) persisted = false;
        else {
          localStorage.setItem(completedKey, JSON.stringify(merged.completed));
          localStorage.setItem(practiceKey, JSON.stringify(merged.practice));
        }
      } catch { persisted = false; }
      setBackupMessage(persisted
        ? `Imported puzzle progress: ${merged.completed.length} solved. Existing progress kept.`
        : "Imported into this tab, but device storage is unavailable. Export a backup before closing.");
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Could not read puzzle backup.");
    }
  };

  return <div className="game-grid">
    <section className="board-shell"><div className="board-wrap"><Chessboard options={{ id: "rookline-puzzle", position: fen, boardOrientation: current.fen.split(" ")[1] === "b" ? "black" : "white", lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" },
      onPieceDrop: ({ sourceSquare, targetSquare }) => !!targetSquare && attempt(sourceSquare as Square, targetSquare as Square),
      onSquareClick: ({ square }) => { const target = square as Square; if (selected && selected !== target && attempt(selected, target)) return; const game = new Chess(fen); setSelected(game.get(target)?.color === game.turn() ? target : null); },
      squareStyles: selected ? { [selected]: { boxShadow: "inset 0 0 0 3px var(--color-focus)" } } : {},
    }} /></div></section>
    <aside className="game-panel">
      <p className="overline">Puzzle {active + 1} of {puzzles.length} · {current.theme} · Level {current.level}</p>
      <h2 className="panel-title">{current.title}</h2><p>{current.description}</p>
      <div className="status" role="status">{feedback || "Drag a piece or click two squares to play your answer."}</div>
      <label className="stack" htmlFor="puzzle-topic" style={{ gap: 7 }}>
        <span className="panel-sub">Practice topic</span>
        <select className="field" id="puzzle-topic" value={theme} disabled={!ready} onChange={(event) => chooseTheme(event.target.value as PuzzleTheme)}>
          {puzzleThemes.map((item) => <option key={item} value={item}>{item === "All" ? "All topics" : item}</option>)}
        </select>
      </label>
      <div className="stack" style={{ gap: 5 }}>
        <button type="button" className={`btn ${adaptive ? "primary" : "ghost"}`} aria-pressed={adaptive} disabled={!ready}
          onClick={() => { const enabled = !adaptive; const latestComplete = (ownsDeviceProgress() ? storedCompletions() : null) ?? complete; setAdaptive(enabled); open(enabled
            ? nextAdaptivePuzzleIndex(-1, theme, latestComplete, (ownsDeviceProgress() ? storedPractice() : null) ?? practice)
            : nextPracticePuzzleIndex(-1, theme, latestComplete)); }}>
          Adaptive review {adaptive ? "on" : "off"}
        </button>
        <p className="panel-sub">Adaptive review revisits positions you missed or needed hints for. Practice history stays on this device.</p>
      </div>
      <form onSubmit={submitKeyboardMove} className="stack" style={{ gap: 7 }}>
        <label htmlFor="puzzle-keyboard-move" className="panel-sub">Keyboard move · e2e4, Qf8+ or a7a8q</label>
        <div className="keyboard-move-row">
          <input id="puzzle-keyboard-move" value={keyboardMove} onChange={(event) => setKeyboardMove(event.target.value)}
            maxLength={12} autoComplete="off" placeholder="e2e4" disabled={!ready || solved} />
          <button type="submit" className="btn ghost" disabled={!ready || solved}>Move</button>
        </div>
      </form>
      <div className="pill-group">{visible.map((index) => <button key={puzzles[index].id} type="button" aria-label={`Puzzle ${index + 1}`} aria-pressed={active === index} disabled={!ready} className={`pill ${active === index ? "active" : ""}`} onClick={() => open(index)}>{index + 1}{complete.includes(puzzles[index].id) ? " ✓" : ""}</button>)}</div>
      <p className="muted">Solved {complete.length} / {puzzles.length} positions on this device.</p>
      <p className="panel-sub">{theme === "All" ? "All topics" : theme}: {visible.filter((index) => complete.includes(puzzles[index].id)).length} / {visible.length} solved.</p>
      <div className="stack" style={{ gap: 7 }}>
        <p className="panel-sub">Move puzzle completions and adaptive practice scores between devices with a JSON backup. Import merges with existing progress.</p>
        <div className="game-actions">
          <button type="button" className="btn ghost" disabled={!ready} onClick={downloadProgress}><Download size={16} /> Export progress</button>
          <button type="button" className="btn ghost" disabled={!ready} onClick={() => backupFileRef.current?.click()}><Upload size={16} /> Import progress</button>
        </div>
        <input ref={backupFileRef} type="file" accept=".json,application/json" hidden aria-label="Choose puzzle backup file" onChange={importProgress} />
        {backupMessage && <p className="panel-sub" role="status">{backupMessage}</p>}
        <p className="panel-sub" aria-live="polite">{cloudMessage}</p>
      </div>
      <div className="game-actions" style={{ marginTop: "auto" }}>
        <button type="button" className="btn ghost" disabled={!ready} onClick={() => { if (!solved) record("hint"); setFeedback(current.hint); }}><Lightbulb size={16} /> Hint</button>
        <button ref={retryButtonRef} type="button" className="btn ghost" disabled={!ready} onClick={() => open(active)}><RotateCcw size={16} /> Retry</button>
        {solved && <button type="button" className="btn primary" onClick={nextPuzzle}>Next puzzle <ArrowRight size={16} /></button>}
      </div>
    </aside>
    {pendingPromotion && <PromotionDialog fallbackFocusRef={retryButtonRef} onChoose={(piece) => attempt(pendingPromotion.from, pendingPromotion.to, piece)} onCancel={() => setPendingPromotion(null)} />}
  </div>;
}
