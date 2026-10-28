import Link from "next/link";
import { ArrowUpRight, BookOpen, Swords } from "lucide-react";
import { authenticatedGameContext } from "@/lib/supabase/server";

export const metadata = { title: "Game archive" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const context = await authenticatedGameContext();
  if (!context.admin || !context.user) {
    return <section className="stack"><div><p className="overline">Match history</p><h1 className="page-title">Your game archive.</h1></div>
      <div className="text-panel stack"><h2>{context.status === 503 ? "Online history is not configured" : "Sign in to view your games"}</h2>
        <p className="muted">{context.status === 503 ? "A Supabase project and database migrations are required to save online matches." : "Your private game history follows your Rookline account."}</p>
        <div className="game-actions"><Link href="/login?next=%2Fgames" className="btn primary">Sign in</Link><Link href="/play/local" className="btn ghost">Play locally</Link></div></div>
    </section>;
  }

  const { data, error } = await context.admin.from("games")
    .select("id, white_id, black_id, base_ms, increment_ms, status, result, winner_id, ply, created_at")
    .or(`white_id.eq.${context.user.id},black_id.eq.${context.user.id}`)
    .order("created_at", { ascending: false }).limit(100);

  return <section className="stack"><div><p className="overline">Match history</p><h1 className="page-title">Your game archive.</h1>
    <p className="muted">Server-saved online games from your account, with a link back to every board.</p></div>
    {error ? <p role="alert" className="status">Unable to load game history. Try refreshing the page.</p>
      : !data?.length ? <div className="text-panel stack"><BookOpen size={32} /><h2>Your archive starts with a game.</h2>
        <p className="muted">Create a private online challenge. Finished and ongoing games will appear here after they are saved.</p>
        <Link className="btn primary" href="/play/online">Create your first game</Link></div>
      : <div className="stack">{data.map((game) => {
        const ownColor = game.white_id === context.user.id ? "White" : "Black";
        const outcome = game.status !== "completed" ? game.status === "waiting" ? "Waiting for opponent" : "In progress"
          : game.winner_id ? game.winner_id === context.user.id ? "Won" : "Lost" : "Draw";
        return <Link key={game.id} className="text-panel" href={`/game/${game.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ display: "grid", gap: 6 }}><strong style={{ display: "flex", alignItems: "center", gap: 10 }}><Swords size={18} />{outcome} · {ownColor}</strong>
            <span className="muted">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · {game.ply} half-moves · {new Date(game.created_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</span>
            <small className="muted">{game.result ?? (game.status === "completed" ? "Completed" : "Unrated private match")}</small></span><ArrowUpRight size={19} />
        </Link>;
      })}</div>}
  </section>;
}
