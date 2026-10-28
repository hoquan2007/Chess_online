import Link from "next/link";
import { Trophy } from "lucide-react";
import { serverSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";
type Category = "bullet" | "blitz" | "rapid";
const categories: Category[] = ["bullet", "blitz", "rapid"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const selected = (await searchParams).category;
  const category: Category = categories.includes(selected as Category) ? selected as Category : "blitz";
  const client = await serverSupabase();
  const session = client ? await client.auth.getUser() : null;
  const user = session?.data.user;

  if (!client || !user) return <section className="stack"><div><p className="overline">The rankings</p><h1 className="page-title">Leaderboard.</h1></div>
    <div className="text-panel stack"><h2>{!client ? "Rankings need a connected service" : "Sign in to see player rankings"}</h2>
      <p className="muted">Ratings are based on verified server-side match results once rated games are enabled.</p>
      <Link className="btn primary" href="/login?next=%2Fleaderboard">Sign in</Link></div></section>;

  const { data: rankings, error } = await client.from("ratings")
    .select("user_id,rating,games_played").eq("category", category).gt("games_played", 0)
    .order("rating", { ascending: false }).limit(50);
  const { data: profiles, error: profileError } = rankings?.length
    ? await client.from("profiles").select("id,username,display_name").in("id", rankings.map((rank) => rank.user_id))
    : { data: [], error: null };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return <section className="stack"><div><p className="overline">The rankings</p><h1 className="page-title">Leaderboard.</h1>
    <p className="muted">Verified rated games only. Rankings appear as players complete rated matches.</p></div>
    <div className="pill-group" aria-label="Rating category">{categories.map((item) => <Link key={item} href={`/leaderboard?category=${item}`} aria-current={category === item ? "page" : undefined}
      className={`pill ${category === item ? "active" : ""}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</div>
    {error || profileError ? <p role="alert" className="status">Unable to load leaderboard data.</p>
      : !rankings?.length ? <div className="text-panel stack"><Trophy size={32} /><h2>No rated results yet.</h2>
        <p className="muted">Private games are currently unrated. Players will appear after rated matchmaking and secure settlement have been verified.</p>
        <Link href="/play/online" className="btn ghost">Play an unrated game</Link></div>
      : <div className="text-panel stack">{rankings.map((rank, index) => <div className="status" key={rank.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span><strong>#{index + 1}</strong> · <Link href={`/profile/${encodeURIComponent(names.get(rank.user_id)?.username ?? "")}`}>{names.get(rank.user_id)?.display_name || names.get(rank.user_id)?.username || "Player"}</Link></span>
          <span><strong>{rank.rating}</strong> <small className="muted">· {rank.games_played} games</small></span></div>)}</div>}
  </section>;
}
