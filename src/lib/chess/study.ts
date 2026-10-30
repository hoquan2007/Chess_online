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
  {
    id: "french", title: "French Defense", subtitle: "Solid center · 1.e4 e6",
    moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"],
    idea: "Black supports a central pawn chain before challenging e4. White gets room to develop but must watch the pressure on d4 and e4.",
    takeaway: "When pawns meet in the center, identify which pawn breaks will free your pieces.",
    steps: ["Take central space with e4.", "Prepare to challenge the center with d5.", "Support e4 with another pawn.", "Contest the center directly.", "Develop a knight and protect e4.", "Attack e4 while developing a knight."],
  },
  {
    id: "caro-kann", title: "Caro-Kann Defense", subtitle: "Reliable structure · 1.e4 c6",
    moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4"],
    idea: "Black prepares ...d5 with c6, keeping the light-squared bishop free to develop. White can regain the central pawn with a knight.",
    takeaway: "Supporting a pawn break in advance can keep your pieces flexible.",
    steps: ["Occupy e4 and control d5.", "Prepare a supported d5 advance.", "Build a broad pawn center.", "Challenge the e4 pawn.", "Support the center and develop.", "Exchange the d-pawn for White's e-pawn.", "Recapture with a developing knight."],
  },
  {
    id: "scandinavian", title: "Scandinavian Defense", subtitle: "Immediate challenge · 1.e4 d5",
    moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"],
    idea: "Black challenges White's first central pawn immediately. The early queen recapture gives White a developing move against the queen.",
    takeaway: "Look for moves that develop a piece and attack an exposed enemy piece at the same time.",
    steps: ["Claim the center.", "Challenge e4 before White reinforces it.", "Capture the pawn that advanced to d5.", "Restore material balance with the queen.", "Develop a knight with tempo against the queen.", "Move the queen off the knight's attack."],
  },
  {
    id: "london", title: "London System", subtitle: "Flexible development · 1.d4 d5",
    moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3"],
    idea: "White develops the dark-squared bishop before locking it behind the e-pawn. Black maintains central control without rushing a capture.",
    takeaway: "Consider the order of your developing moves, especially when a pawn advance could restrict a bishop.",
    steps: ["Secure central space with d4.", "Match central control with d5.", "Develop a knight and guard d4.", "Develop toward the center.", "Place the bishop outside the future pawn chain.", "Prepare to reinforce d5 and release the dark-squared bishop later.", "Support d4 and open the light-squared bishop."],
  },
  {
    id: "english", title: "English Opening", subtitle: "Flank approach · 1.c4 e5",
    moves: ["c4", "e5", "Nc3", "Nf6", "g3", "d5"],
    idea: "White controls d5 from the side instead of occupying the center immediately. Black can use a timely pawn break to claim central space.",
    takeaway: "A flank pawn can influence the center; check which central breaks each side is preparing.",
    steps: ["Pressure d5 from the c-file.", "Occupy the center with e5.", "Develop the knight and support d5 control.", "Develop and pressure the e4 square.", "Prepare to fianchetto the king's bishop.", "Strike in the center while White prepares the bishop."],
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
  {
    id: "castle", title: "Castle before complications", subtitle: "Beginner · king safety",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6", "d3", "O-O"],
    idea: "Both sides bring minor pieces into play and make space for the king to castle. Only then do they prepare the next pawn moves.",
    takeaway: "Castling usually improves king safety and connects your rook with the center.",
    steps: ["Occupy the center.", "Challenge White's central pawn.", "Develop the knight and attack e5.", "Develop while defending e5.", "Free the kingside and point the bishop toward f7.", "Develop the bishop and prepare to castle.", "Move the king to safety and activate the rook.", "Develop the remaining kingside knight.", "Support the center without exposing the king.", "Black castles to protect the king too."],
  },
  {
    id: "pawn-break", title: "Prepare a central pawn break", subtitle: "Intermediate · pawn structure",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O", "Bd3", "d5"],
    idea: "In the Nimzo-Indian structure, Black pins a knight and then plays ...d5 against White's center after securing the king.",
    takeaway: "A pawn break is more effective when development supports it and your king is safe.",
    steps: ["Control e5 with the d-pawn.", "Develop and influence e4.", "Claim more space on the queenside.", "Prepare to challenge the pawn center.", "Support the central squares with a knight.", "Pin the knight and pressure the center.", "Open the bishop's diagonal and strengthen d4.", "Castle before opening central lines.", "Develop the bishop toward the kingside.", "Break in the center with a defended d-pawn."],
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
