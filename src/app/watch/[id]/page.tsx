import { notFound } from 'next/navigation';
import { validUuid } from '@/lib/online/games';
import { SpectatorBoard } from '@/components/SpectatorBoard';

export const metadata = { title: 'Watch a game · Rookline' };

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validUuid(id)) notFound();
  return <SpectatorBoard key={id} id={id} />;
}
