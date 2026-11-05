import { ModeratorQueue } from '@/components/ModeratorQueue';

export const metadata = { title: 'Moderation' };

export default function ModerationPage() {
  return <section className="stack"><div><p className="overline">Restricted access</p>
    <h1 className="page-title">Moderation queue.</h1>
    <p className="muted">Review submitted player concerns. This queue is available only to appointed moderators.</p></div>
    <ModeratorQueue />
  </section>;
}
