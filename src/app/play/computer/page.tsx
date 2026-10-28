import { GameWorkspace } from "@/components/GameWorkspace";
export const metadata = { title: "Computer chess" };
export default function ComputerPage() { return <><p className="overline">Practice mode</p><h1 className="page-title">You versus the board.</h1><p className="muted">Choose a side and train against a local chess engine.</p><GameWorkspace mode="computer" /></>; }
