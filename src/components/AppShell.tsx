"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Brain, Castle, CircleHelp, Gamepad2, Home, Moon, Puzzle, Settings, Sun, Swords, Trophy, Users, ChartNoAxesCombined } from "lucide-react";

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
  const [light, setLight] = useState(false);
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
        <Link href="/" className="brand"><span className="brand-icon"><Castle size={24} /></span><span>rookline</span></Link>
        <nav className="nav-stack" aria-label="Primary navigation">{navigation.map(navLink)}</nav>
        <nav className="nav-stack secondary" aria-label="More pages">{extra.map(navLink)}</nav>
        <p className="sidebar-foot">A better game starts here.<br />Built for the love of chess.</p>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-label">Every move matters. Make yours.</span>
          <div className="topbar-right">
            <Link className="btn ghost" href="/play/online"><ChartNoAxesCombined size={17} /> <span className="max-sm:hidden">Online play</span></Link>
            <button type="button" className="icon-btn" aria-label={light ? "Use dark theme" : "Use light theme"} title="Toggle theme" onClick={toggleTheme}>{light ? <Moon size={19} /> : <Sun size={19} />}</button>
            <Link href="/login" className="icon-btn" title="Account" aria-label="Account"><CircleHelp size={19} /></Link>
          </div>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
    </div>
  );
}
