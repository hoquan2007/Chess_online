import { Chess } from "chess.js";

export const puzzles = [
  { id: "mate-001", theme: "Checkmate", level: 1, title: "The queen finishes", description: "White to move. Checkmate in one.", fen: "6k1/6pp/5KQ1/8/8/8/8/8 w - - 0 1", solution: "Qxg7#", hint: "Look at the undefended pawn beside the king." },
  { id: "mate-002", theme: "Checkmate", level: 1, title: "The back corner", description: "White to move. Checkmate in one.", fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1", solution: "Qc8#", hint: "Keep the king trapped on the last rank." },
  { id: "tactic-003", theme: "Capture", level: 2, title: "Escape with tempo", description: "White is in check. Find the best capture.", fen: "4k3/8/8/8/8/8/4r3/4KQ2 w - - 0 1", solution: "Qxe2+", hint: "Your queen can capture the rook while checking the king." },
  { id: "mate-004", theme: "Checkmate", level: 2, title: "Seal the back rank", description: "White to move. A rook can deliver checkmate in one.", fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", solution: "Re8#", hint: "The three pawns block their own king's escape squares." },
  { id: "fork-005", theme: "Fork", level: 2, title: "Knight fork", description: "White to move. Check the king and attack the queen at once.", fen: "2q1k3/8/8/8/4N3/8/8/4K3 w - - 0 1", solution: "Nd6+", hint: "A knight jump can threaten two pieces without standing between them." },
  { id: "pin-006", theme: "Pin", level: 2, title: "Pin the defender", description: "White to move. Pin the black knight to its queen.", fen: "3qk3/8/5n2/8/8/8/8/2B1K3 w - - 0 1", solution: "Bg5", hint: "Find a bishop diagonal passing through f6 to d8." },
  { id: "mate-007", theme: "Checkmate", level: 3, title: "No flight squares", description: "White to move. A knight delivers checkmate in one.", fen: "6rk/7p/8/4N3/8/8/8/4K1R1 w - - 0 1", solution: "Nf7#", hint: "The rook on g1 controls the king's only open escape square." },
  { id: "tactic-008", theme: "Capture", level: 1, title: "Take the hanging queen", description: "White to move. Capture the most valuable unprotected piece.", fen: "4k3/8/8/8/8/8/2q5/2R1K3 w - - 0 1", solution: "Rxc2", hint: "The rook can capture vertically along the c-file." },
  { id: "endgame-009", theme: "Promotion", level: 2, title: "Promote the passer", description: "White to move. Promote the pawn with check.", fen: "6k1/P7/8/8/8/8/8/4K3 w - - 0 1", solution: "a8=Q+", hint: "Advance to the eighth rank and choose the strongest piece." },
  { id: "fork-010", theme: "Fork", level: 3, title: "A second knight fork", description: "White to move. Check the king while attacking the queen.", fen: "8/2q1k3/8/8/8/2N5/8/4K3 w - - 0 1", solution: "Nd5+", hint: "Look for a central square attacking e7 and c7." },
] as const;

export const puzzleThemes = ["All", "Checkmate", "Fork", "Pin", "Capture", "Promotion"] as const;
export type PuzzleTheme = (typeof puzzleThemes)[number];

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

export function evaluatePuzzleMove(id: string, from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q") {
  const puzzle = puzzles.find((item) => item.id === id);
  if (!puzzle) return { status: "illegal" as const };
  const game = new Chess(puzzle.fen);
  try {
    const played = game.move({ from, to, promotion });
    // A mate-in-one problem can have more than one mating move. Accept every
    // genuine checkmate instead of rejecting a valid alternative solution.
    const solved = puzzle.description.toLowerCase().includes("checkmate in one")
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
