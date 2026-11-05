import { ReportCenter } from '@/components/ReportCenter';

export const metadata = { title: 'Report a player' };

export default function ReportPage() {
  return <section className="stack"><div><p className="overline">Community safety</p>
    <h1 className="page-title">Report a player.</h1>
    <p className="muted">Raise concerns about abuse, spam or unfair play for private review.</p></div>
    <ReportCenter />
  </section>;
}
