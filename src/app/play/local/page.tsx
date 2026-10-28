import { GameWorkspace } from "@/components/GameWorkspace";
export const metadata = { title: "Local chess" };
export default function LocalPage() { return <><p className="overline">Two players, one screen</p><h1 className="page-title">Local chess</h1><p className="muted">Move by dragging or selecting a piece. All standard legal moves are checked.</p><GameWorkspace mode="local" /></>; }
