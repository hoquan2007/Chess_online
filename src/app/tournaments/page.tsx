import Link from 'next/link';
import { TournamentCenter } from '@/components/TournamentCenter';

export const metadata = { title: 'Tournaments' };

export default function TournamentsPage() {
  return <section className="stack"><div><p className="overline">Community events</p>
    <h1 className="page-title">Tournaments.</h1>
    <p className="muted">Plan an event, reserve a place and manage your registrations.</p>
    <p className="muted">Organizing a local club round robin? <Link className="tournament-planner-link" href="/tournaments/planner">Open the offline pairing planner →</Link></p></div>
    <TournamentCenter />
  </section>;
}
