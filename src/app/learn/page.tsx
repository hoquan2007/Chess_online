import { StudyExplorer } from "@/components/StudyExplorer";
import { lessonLines } from "@/lib/chess/study";

export const metadata = { title: "Learn chess" };

export default function LearnPage() {
  return <section className="stack"><div><p className="overline">Rookline academy</p>
    <h1 className="page-title">Learn one idea at a time.</h1>
    <p className="muted">Three original lessons. Step through each position and watch how ideas become moves.</p></div>
    <StudyExplorer lines={lessonLines} />
  </section>;
}
