import { FriendCenter } from '@/components/FriendCenter';
import Link from 'next/link';

export const metadata = { title: 'Friends' };

export default function FriendsPage() {
  return <section className="stack"><div><p className="overline">Your community</p>
    <h1 className="page-title">Friends and notifications.</h1>
    <p className="muted">Connect with other players, exchange private messages with friends, and manage who can reach you.</p></div>
    <FriendCenter />
    <p className="muted">Need help with player conduct? <Link href="/report">Report a player</Link>.</p>
  </section>;
}
