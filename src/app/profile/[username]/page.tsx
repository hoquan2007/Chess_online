import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { serverSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Player profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!/^[a-z0-9_]{3,24}$/.test(username)) notFound();
  const client = await serverSupabase();
  if (!client) return <section className="stack"><p className="overline">Player profile</p><h1 className="page-title">Profiles need a connected service.</h1>
    <p className="muted">Connect Supabase and apply the migrations to view real player accounts.</p><Link className="btn ghost" href="/play/local">Play locally</Link></section>;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return <div className="text-panel stack"><h1 className="page-title">Sign in to browse profiles.</h1>
    <Link className="btn primary" href={`/login?next=${encodeURIComponent(`/profile/${username}`)}`}>Sign in</Link></div>;
  const { data: profile, error } = await client.from("profiles").select("id,username,display_name,created_at").eq("username", username).maybeSingle();
  if (error) return <p role="alert" className="status">Unable to load player profile.</p>;
  if (!profile) notFound();
  const { data: ratings, error: ratingError } = await client.from("ratings")
    .select("category,rating,games_played").eq("user_id", profile.id).order("category");
  const ownProfile = profile.id === user.id;

  return <section className="stack"><div><p className="overline">Rookline player</p>
    <div className="game-actions" style={{ alignItems: "center" }}><div className="player-avatar" style={{ width: 68, height: 68 }}><UserRound size={34} /></div>
      <div><h1 className="page-title">{profile.display_name || profile.username}</h1><p className="muted">@{profile.username}</p></div></div>
    <p className="muted">Joined {new Date(profile.created_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}</p></div>
    <div className="text-panel stack"><h2>Rated performance</h2>
      {ratingError ? <p role="alert" className="status">Ratings could not be loaded.</p>
        : !ratings?.length ? <p className="muted">No verified rated results yet. Private games do not change ratings.</p>
        : <div className="info-grid">{ratings.map((entry) => <div className="status" key={entry.category}><strong>{entry.category.toUpperCase()}</strong>
          <p>{entry.rating} rating · {entry.games_played} games</p></div>)}</div>}
    </div>
    {ownProfile ? <div className="game-actions"><Link className="btn primary" href="/games">Your match history</Link><Link className="btn ghost" href="/play/online">Play online</Link></div>
      : <p className="muted">Match history is visible to the participating players.</p>}
  </section>;
}
