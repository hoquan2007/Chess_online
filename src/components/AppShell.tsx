"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Brain, Castle, Gamepad2, Home, LogIn, LogOut, Moon, Puzzle, Settings, Sun, Swords, Trophy, Users, ChartNoAxesCombined, UserRound } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import { RooklineMark } from "@/components/RooklineMark";

const navigation = [
  { href: "/", title: "Home", icon: Home },
  { href: "/play", title: "Play", icon: Swords },
  { href: "/puzzles", title: "Puzzles", icon: Puzzle },
  { href: "/analysis", title: "Analysis", icon: Brain },
  { href: "/learn", title: "Learn", icon: BookOpen },
];
const extra = [
  { href: "/openings", title: "Openings", icon: Gamepad2 },
  { href: "/games", title: "My games", icon: Castle },
  { href: "/leaderboard", title: "Leaderboard", icon: Trophy },
  { href: "/tournaments", title: "Tournaments", icon: Users },
  { href: "/settings", title: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [light, setLight] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    const client = browserSupabase();
    if (!client) return;
    let alive = true;
    void client.auth.getUser().then(({ data }) => { if (alive) setAccount(data.user?.email ?? null); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) setAccount(session?.user.email ?? null);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    await browserSupabase()?.auth.signOut();
    setAccount(null);
    router.push("/login");
    router.refresh();
  }
  useEffect(() => {
    const syncTheme = () => {
      const isLight = localStorage.getItem("rookline-theme") === "light";
      document.documentElement.classList.toggle("theme-light", isLight);
      queueMicrotask(() => setLight(isLight));
    };
    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("rookline:preferences-changed", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("rookline:preferences-changed", syncTheme);
    };
  }, []);
  const toggleTheme = () => {
    const next = !light;
    localStorage.setItem("rookline-theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("theme-light", next);
    setLight(next);
  };
  const navLink = ({ href, title, icon: Icon }: (typeof navigation)[number]) => (
    <Link key={href} href={href} className={`nav-link ${pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "active" : ""}`} aria-current={pathname === href ? "page" : undefined} title={title}>
      <Icon size={19} aria-hidden="true" /><span>{title}</span>
    </Link>
  );
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Site navigation">
        <Link href="/" className="brand"><RooklineMark /><span>rookline</span></Link>
        <nav className="nav-stack" aria-label="Primary navigation">{navigation.map(navLink)}</nav>
        <nav className="nav-stack secondary" aria-label="More pages">{extra.map(navLink)}</nav>
        <p className="sidebar-foot">A better game starts here.<br />Built for the love of chess.</p>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-label">Every move matters. Make yours.</span>
          <Link href="/" className="mobile-brand" aria-label="Rookline home"><RooklineMark size={32} /><span>rookline</span></Link>
          <div className="topbar-right">
            <Link className="btn ghost" href="/play/online"><ChartNoAxesCombined size={17} /> <span className="max-sm:hidden">Online play</span></Link>
            <button type="button" className="icon-btn" aria-label={light ? "Use dark theme" : "Use light theme"} title="Toggle theme" onClick={toggleTheme}>{light ? <Moon size={19} /> : <Sun size={19} />}</button>
            {account ? <><span className="account-name" title={account}><UserRound size={15} /> {account}</span><button type="button" className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={19} /></button></> : <><Link href="/register" className="btn ghost account-register">Create account</Link><Link href="/login" className="icon-btn" title="Sign in" aria-label="Sign in"><LogIn size={19} /></Link></>}
          </div>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
    </div>
  );
}
