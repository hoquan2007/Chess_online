import Link from 'next/link';
import { TournamentPlanner } from '@/components/TournamentPlanner';

export const metadata = { title: 'Round-robin planner' };

export default function TournamentPlannerPage() {
  return <section className="stack">
    <div><Link href="/tournaments" className="muted">← Back to tournaments</Link>
      <h1 className="page-title">Plan your rounds.</h1>
      <p className="muted">An independent pairing and score workshop for small chess clubs.</p></div>
    <TournamentPlanner />
  </section>;
}
