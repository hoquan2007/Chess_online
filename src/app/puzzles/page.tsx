import { PuzzleTrainer } from "@/components/PuzzleTrainer";
export const metadata = { title: "Chess puzzles" };
export default function PuzzlePage() { return <><p className="overline">Tactical training</p><h1 className="page-title">Find the winning idea.</h1><p className="muted">Original, hand-crafted positions to develop your board vision.</p><PuzzleTrainer /></>; }
