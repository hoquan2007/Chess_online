import { Chess } from "chess.js";

export const puzzles = [
  { id: "mate-001", theme: "Checkmate", goal: "mate", level: 1, title: "The queen finishes", description: "White to move. Checkmate in one.", fen: "6k1/6pp/5KQ1/8/8/8/8/8 w - - 0 1", solution: "Qxg7#", hint: "Look at the undefended pawn beside the king." },
  { id: "mate-002", theme: "Checkmate", goal: "mate", level: 1, title: "The back corner", description: "White to move. Checkmate in one.", fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1", solution: "Qc8#", hint: "Keep the king trapped on the last rank." },
  { id: "tactic-003", theme: "Capture", goal: "move", level: 2, title: "Escape with tempo", description: "White is in check. Find the best capture.", fen: "4k3/8/8/8/8/8/4r3/4KQ2 w - - 0 1", solution: "Qxe2+", hint: "Your queen can capture the rook while checking the king." },
  { id: "mate-004", theme: "Checkmate", goal: "mate", level: 2, title: "Seal the back rank", description: "White to move. A rook can deliver checkmate in one.", fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", solution: "Re8#", hint: "The three pawns block their own king's escape squares." },
  { id: "fork-005", theme: "Fork", goal: "move", level: 2, title: "Knight fork", description: "White to move. Check the king and attack the queen at once.", fen: "2q1k3/8/8/8/4N3/8/8/4K3 w - - 0 1", solution: "Nd6+", hint: "A knight jump can threaten two pieces without standing between them." },
  { id: "pin-006", theme: "Pin", goal: "move", level: 2, title: "Pin the defender", description: "White to move. Pin the black knight to its queen.", fen: "3qk3/8/5n2/8/8/8/8/2B1K3 w - - 0 1", solution: "Bg5", hint: "Find a bishop diagonal passing through f6 to d8." },
  { id: "mate-007", theme: "Checkmate", goal: "mate", level: 3, title: "No flight squares", description: "White to move. A knight delivers checkmate in one.", fen: "6rk/7p/8/4N3/8/8/8/4K1R1 w - - 0 1", solution: "Nf7#", hint: "The rook on g1 controls the king's only open escape square." },
  { id: "tactic-008", theme: "Capture", goal: "move", level: 1, title: "Take the hanging queen", description: "White to move. Capture the most valuable unprotected piece.", fen: "4k3/8/8/8/8/8/2q5/2R1K3 w - - 0 1", solution: "Rxc2", hint: "The rook can capture vertically along the c-file." },
  { id: "endgame-009", theme: "Promotion", goal: "move", level: 2, title: "Promote the passer", description: "White to move. Promote the pawn with check.", fen: "6k1/P7/8/8/8/8/8/4K3 w - - 0 1", solution: "a8=Q+", hint: "Advance to the eighth rank and choose the strongest piece." },
  { id: "fork-010", theme: "Fork", goal: "move", level: 3, title: "A second knight fork", description: "White to move. Check the king while attacking the queen.", fen: "8/2q1k3/8/8/8/2N5/8/4K3 w - - 0 1", solution: "Nd5+", hint: "Look for a central square attacking e7 and c7." },
  { id: "mate-011", theme: "Checkmate", goal: "mate", level: 2, title: "The distant rook", description: "White to move. Checkmate in one against the boxed-in king.", fen: "1k6/ppp5/8/8/8/8/8/3R2K1 w - - 0 1", solution: "Rd8#", hint: "A rook on the eighth rank controls every square along that rank." },
  { id: "mate-012", theme: "Checkmate", goal: "mate", level: 2, title: "Black strikes the back rank", description: "Black to move. Checkmate in one.", fen: "k3r3/8/8/8/8/8/5PPP/6K1 b - - 0 1", solution: "Re1#", hint: "White's own pawns block the king's escape." },
  { id: "fork-013", theme: "Fork", goal: "move", level: 3, title: "Black's double attack", description: "Black to move. Check the white king and attack the queen on c5.", fen: "k7/8/5n2/2Q5/8/6K1/8/8 b - - 0 1", solution: "Ne4+", hint: "A knight from f6 can attack g3 and c5 at once." },
  { id: "fork-014", theme: "Fork", goal: "move", level: 3, title: "Across the board", description: "White to move. Fork the black king and queen with a knight check.", fen: "8/8/2q3k1/8/8/5N2/8/K7 w - - 0 1", solution: "Ne5+", hint: "Look at the squares controlled by a knight on e5." },
  { id: "pin-015", theme: "Pin", goal: "move", level: 2, title: "A knight cannot leave", description: "White to move. Pin the knight on c6 to the king on e8.", fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", solution: "Bb5", hint: "The bishop can line up with the knight and king on one diagonal." },
  { id: "capture-016", theme: "Capture", goal: "move", level: 1, title: "Diagonal sweep", description: "White to move. Capture the undefended rook.", fen: "6k1/8/8/8/1r6/8/3Q4/4K3 w - - 0 1", solution: "Qxb4", hint: "The queen can travel from d2 through c3." },
  { id: "capture-017", theme: "Capture", goal: "move", level: 2, title: "The open file", description: "Black to move. Capture the exposed white queen.", fen: "r5k1/8/8/8/Q7/8/8/4K3 b - - 0 1", solution: "Rxa4", hint: "Scan the a-file for an unprotected major piece." },
  { id: "promotion-018", theme: "Promotion", goal: "move", level: 2, title: "Black promotes with check", description: "Black to move. Promote to a queen and give check.", fen: "6k1/8/8/8/8/8/4p3/K7 b - - 0 1", solution: "e1=Q+", hint: "The e-pawn can reach the first rank immediately." },
  { id: "promotion-019", theme: "Promotion", goal: "move", level: 2, title: "Queen on the eighth", description: "White to move. Promote to a queen with check.", fen: "k7/6P1/8/8/8/8/8/7K w - - 0 1", solution: "g8=Q+", hint: "The new queen will attack across the eighth rank." },
  { id: "mate-020", theme: "Checkmate", goal: "mate", level: 3, title: "The defended sacrifice", description: "White to move. Checkmate in one using bishop and rook support.", fen: "6k1/6pp/8/7Q/8/3B4/8/5RK1 w - - 0 1", solution: "Qxh7#", hint: "The bishop guards h7, while the rook takes away f8." },
  { id: "promotion-021", theme: "Promotion", goal: "move", level: 3, title: "A knight from nowhere", description: "White to move. Underpromote to fork the king on e7 and queen on f6.", fen: "8/4k1P1/5q2/8/8/8/K7/8 w - - 0 1", solution: "g8=N+", hint: "A knight on g8 checks the king on e7 and attacks the queen on f6. Choose the promotion piece carefully." },
] as const;

export const puzzleThemes = ["All", "Checkmate", "Fork", "Pin", "Capture", "Promotion"] as const;
export type PuzzleTheme = (typeof puzzleThemes)[number];

export type PuzzlePractice = Record<string, { errors: number; hints: number; solves: number }>;
export type PuzzlePracticeEvent = "error" | "hint" | "solve";

/** Ignore unknown and malformed puzzle IDs restored from device storage. */
export function readPuzzleCompletions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<string>(puzzles.map((puzzle) => puzzle.id));
  return Array.from(new Set(raw.filter((id): id is string => typeof id === "string" && known.has(id))));
}

/** Read only known puzzle IDs and bounded counters from untrusted device storage. */
export function readPuzzlePractice(raw: unknown): PuzzlePractice {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const stored = raw as Record<string, unknown>;
  const practice: PuzzlePractice = {};
  const counter = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 9999
    ? value as number : 0;
  for (const puzzle of puzzles) {
    const entry = stored[puzzle.id];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const data = entry as Record<string, unknown>;
    practice[puzzle.id] = { errors: counter(data.errors), hints: counter(data.hints), solves: counter(data.solves) };
  }
  return practice;
}

export function recordPuzzlePractice(practice: PuzzlePractice, id: string, event: PuzzlePracticeEvent): PuzzlePractice {
  if (!puzzles.some((puzzle) => puzzle.id === id)) return practice;
  const entry = practice[id] ?? { errors: 0, hints: 0, solves: 0 };
  const field = event === "error" ? "errors" : event === "hint" ? "hints" : "solves";
  return { ...practice, [id]: { ...entry, [field]: Math.min(9999, entry[field] + 1) } };
}

export function puzzleIndicesForTheme(theme: PuzzleTheme): number[] {
  return puzzles.flatMap((puzzle, index) => theme === "All" || puzzle.theme === theme ? [index] : []);
}

// Walk forward through the chosen topic, preferring work the player has not
// solved yet. Once all positions are complete, cycle to the next for review.
export function nextPracticePuzzleIndex(currentIndex: number, theme: PuzzleTheme, completed: readonly string[]): number {
  const indices = puzzleIndicesForTheme(theme);
  if (indices.length === 0) return 0;
  const position = indices.indexOf(currentIndex);
  const next = [...indices.slice(position + 1), ...indices.slice(0, position + 1)];
  return next.find((index) => !completed.includes(puzzles[index].id)) ?? next[0];
}

/** Choose weak positions from actual practice history. A new position has a
 * modest advantage; repeated errors and hints can outweigh that advantage.
 * Solving a position repeatedly lowers its review priority. Ties rotate in
 * catalogue order, avoiding immediate repetition when alternatives exist. */
export function nextAdaptivePuzzleIndex(
  currentIndex: number, theme: PuzzleTheme, completed: readonly string[], practice: PuzzlePractice,
): number {
  const indices = puzzleIndicesForTheme(theme);
  if (indices.length <= 1) return indices[0] ?? 0;
  const position = indices.indexOf(currentIndex);
  const candidates = [...indices.slice(position + 1), ...indices.slice(0, position + 1)]
    .filter((index) => index !== currentIndex);
  const score = (index: number) => {
    const stats = practice[puzzles[index].id] ?? { errors: 0, hints: 0, solves: 0 };
    return (completed.includes(puzzles[index].id) ? 0 : 8) +
      Math.min(stats.errors, 6) * 4 + Math.min(stats.hints, 3) * 2 - Math.min(stats.solves, 5) * 5;
  };
  return candidates.reduce((best, index) => score(index) > score(best) ? index : best, candidates[0]);
}

export function evaluatePuzzleMove(id: string, from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q") {
  const puzzle = puzzles.find((item) => item.id === id);
  if (!puzzle) return { status: "illegal" as const };
  const game = new Chess(puzzle.fen);
  try {
    const played = game.move({ from, to, promotion });
    // Mate objectives accept every genuine mate, independent of translated
    // presentation copy. Other tactics check the authored SAN solution.
    const solved = puzzle.goal === "mate"
      ? game.isCheckmate()
      : played.san === puzzle.solution;
    return solved
      ? { status: "correct" as const, fen: game.fen(), san: played.san }
      : { status: "incorrect" as const };
  } catch {
    return { status: "illegal" as const };
  }
}

export function isPuzzleSolution(id: string, from: string, to: string): boolean {
  return evaluatePuzzleMove(id, from, to).status === "correct";
}
