import { AnalysisWorkspace } from "@/components/AnalysisWorkspace";
export const metadata = { title: "Analysis board" };
export default function AnalysisPage() { return <><p className="overline">Study the board</p><h1 className="page-title">Think a move deeper.</h1><p className="muted">Every position tells a story. Follow it, change it, learn from it.</p><AnalysisWorkspace /></>; }
