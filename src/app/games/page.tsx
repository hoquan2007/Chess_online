import Link from "next/link";
import { authenticatedGameContext } from "@/lib/supabase/server";
import { LocalGameArchive } from "@/components/LocalGameArchive";
import { OnlineGameHistory } from "@/components/OnlineGameHistory";
import { loadGameHistory } from "@/lib/online/history-query";

export const metadata = { title: "Game archive" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const context = await authenticatedGameContext();
  if (!context.admin || !context.user) {
    return <section className="stack"><div><p className="overline">Match history</p><h1 className="page-title">Your game archive.</h1></div>
      <div className="text-panel stack"><h2>{context.status === 503 ? "Online history is not configured" : "Sign in to view your games"}</h2>
        <p className="muted">{context.status === 503 ? "A Supabase project and database migrations are required to save online matches." : "Your private game history follows your Rookline account."}</p>
        <div className="game-actions"><Link href="/login?next=%2Fgames" className="btn primary">Sign in</Link><Link href="/play/local" className="btn ghost">Play locally</Link></div></div>
      <LocalGameArchive />
    </section>;
  }

  let history;
  try { history = await loadGameHistory(context.admin, context.user.id, null); }
  catch { history = null; }

  return <section className="stack"><div><p className="overline">Match history</p><h1 className="page-title">Your game archive.</h1>
    <p className="muted">Server-saved online games from your account, with a link back to every board.</p></div>
    {history ? <OnlineGameHistory userId={context.user.id} initialGames={history.games} initialCursor={history.nextCursor} />
      : <p role="alert" className="status">Unable to load game history. Try refreshing the page.</p>}
    <LocalGameArchive />
  </section>;
}
