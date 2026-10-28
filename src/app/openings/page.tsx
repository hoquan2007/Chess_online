import { StudyExplorer } from "@/components/StudyExplorer";
import { openingLines } from "@/lib/chess/study";

export const metadata = { title: "Opening explorer" };

export default function OpeningsPage() {
  return <section className="stack"><div><p className="overline">Opening library</p>
    <h1 className="page-title">Know your first moves.</h1>
    <p className="muted">Explore five classical opening setups through legal moves and original explanations.</p></div>
    <StudyExplorer lines={openingLines} />
  </section>;
}
