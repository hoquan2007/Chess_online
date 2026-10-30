import { Chess } from "chess.js";
import type { MoveInput } from "./rules";

export type StudyLine = {
  id: string;
  title: string;
  subtitle: string;
  moves: readonly string[];
  idea: string;
  takeaway: string;
  steps: readonly string[];
};

// Original instructional text and curated examples: no third-party puzzle/lesson dataset.
export const openingLines: readonly StudyLine[] = [
  {
    id: "italian", title: "Italian Game", subtitle: "Open games · 1.e4 e5",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    idea: "White develops toward the center and points the bishop at f7. Black answers with an equally active bishop.",
    takeaway: "Build your position around quick development and kingside safety before starting tactics.",
    steps: ["Claim space in the center.", "Keep the center balanced.", "Attack e5 and free the kingside.", "Defend e5 while developing.", "Aim the bishop along the a2–g8 diagonal.", "Contest the same diagonal and prepare to castle."],
  },
  {
    id: "ruy-lopez", title: "Ruy Lopez", subtitle: "Open games · 1.e4 e5",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"],
    idea: "Instead of immediately attacking f7, White pressures the knight guarding e5. Black challenges the bishop's placement.",
    takeaway: "A threat to a defender can be as useful as a threat to a piece.",
    steps: ["Stake a claim on d5.", "Challenge the center directly.", "Develop with tempo against e5.", "Guard the pawn with a piece.", "Pressure the e5 defender.", "Ask the bishop to choose a square."],
  },
  {
    id: "queens-gambit", title: "Queen’s Gambit", subtitle: "Queen’s Pawn Game · 1.d4 d5",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
    idea: "White offers the c-pawn to challenge Black's d5 pawn. The gambit is about central influence and piece activity.",
    takeaway: "A pawn move can be an investment in squares rather than an attempt to win material.",
    steps: ["Control e5 and claim central space.", "Challenge e4 and reinforce the center.", "Pressure d5 from the side.", "Defend d5 and free the dark-squared bishop later.", "Support future central play.", "Attack e4 and finish a key developing move."],
  },
  {
    id: "sicilian", title: "Sicilian Defense", subtitle: "Asymmetrical · 1.e4 c5",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"],
    idea: "Black attacks d4 from the flank. The imbalance gives both sides chances, but exact calculation matters.",
    takeaway: "When the pawn structure becomes asymmetrical, watch open files and the central pawn breaks.",
    steps: ["Claim e4 and d5.", "Challenge d4 without mirroring e5.", "Prepare the central advance.", "Guard e5 and support development.", "Trade central pawns to open lines.", "Accept the exchange in the center.", "Recapture with a developed piece."],
  },
  {
    id: "kings-indian", title: "King’s Indian Defense", subtitle: "Hypermodern · 1.d4 Nf6",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
    idea: "Black allows White a big pawn center and plans to strike it later from a compact kingside setup.",
    takeaway: "Central control can come from pawns or from pieces attacking those pawns.",
    steps: ["Take space with the queen’s pawn.", "Control e4 without occupying it.", "Expand the central pawn structure.", "Prepare to fianchetto.", "Support e4 and develop.", "Aim the bishop toward the center.", "Complete the pawn center.", "Support e5 and prepare to castle."],
  },
];

export const lessonLines: readonly StudyLine[] = [
  {
    id: "develop", title: "Develop with a purpose", subtitle: "Beginner · opening principles",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    idea: "A good opening move either improves your central presence, prepares your king, or develops a useful piece.",
    takeaway: "Before moving the same piece twice, ask which undeveloped piece could improve your position.",
    steps: ["Occupy the center.", "Black contests it.", "Bring the knight into play and attack e5.", "Black defends with development.", "Activate your bishop and prepare to castle."],
  },
  {
    id: "pins", title: "Understand the pin", subtitle: "Beginner · tactics",
    moves: ["d4", "d5", "Nc3", "Nf6", "Bg5"],
    idea: "A pin restricts a piece because moving it would expose a more valuable target. Here Bg5 pressures the knight in front of Black's queen.",
    takeaway: "Find the piece behind the pinned defender, then ask whether the pin is absolute or relative.",
    steps: ["Take central space.", "Black mirrors the center.", "Develop and support the d-pawn.", "Black develops a knight toward e4.", "Place the bishop on the knight–queen diagonal."],
  },
  {
    id: "scholars", title: "Spot a mating threat", subtitle: "Beginner · king safety",
    moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
    idea: "An early queen attack is rarely the strongest plan against careful play. Here Black overlooks the direct threat to f7.",
    takeaway: "Before every move, inspect your opponent's checks, captures, and threats. Black could have defended the mating threat.",
    steps: ["Occupy the center.", "Black matches the pawn.", "The queen eyes f7 and e5.", "Develop the queen’s knight.", "The bishop adds a second attacker on f7.", "The knight attacks the queen but does not stop mate.", "The queen captures with checkmate."],
  },
];

export function studyPosition(moves: readonly string[], ply: number) {
  if (!Number.isSafeInteger(ply) || ply < 0 || ply > moves.length) throw new Error("Invalid study position");
  const chess = new Chess();
  for (const san of moves.slice(0, ply)) {
    if (!chess.move(san)) throw new Error("Invalid instructional move");
  }
  return chess;
}

export type PracticeSide = "w" | "b";
export type PracticeAttempt =
  | { status: "correct"; ply: number; san: string }
  | { status: "illegal" | "off-line" | "finished"; ply: number };

/** Advance scripted opponent turns without taking away any learner moves. */
export function practiceNextPly(line: StudyLine, side: PracticeSide, ply: number) {
  let next = ply;
  while (next < line.moves.length && (next % 2 === 0 ? "w" : "b") !== side) next++;
  return next;
}

/** Compare the canonical SAN of a legal move to the curated line, never changing its source. */
export function evaluatePracticeMove(line: StudyLine, side: PracticeSide, ply: number, input: MoveInput): PracticeAttempt {
  if (!Number.isSafeInteger(ply) || ply < 0 || ply > line.moves.length || practiceNextPly(line, side, ply) !== ply) {
    throw new Error("Invalid practice turn");
  }
  if (ply === line.moves.length) return { status: "finished", ply };
  const chess = studyPosition(line.moves, ply);
  let move;
  try { move = chess.move(input); } catch { return { status: "illegal", ply }; }
  if (!move) return { status: "illegal", ply };
  if (move.san !== line.moves[ply]) return { status: "off-line", ply };
  return { status: "correct", san: move.san, ply: practiceNextPly(line, side, ply + 1) };
}
