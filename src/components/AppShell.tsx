"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Brain, Castle, ChartNoAxesCombined, ChevronRight, Gamepad2, Home, LogIn, LogOut, Menu, Moon, Puzzle, Settings, Sun, Swords, Trophy, Users, UserRound, X } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import { createAuthBootstrap } from "@/lib/supabase/auth-bootstrap";
import { RooklineMark } from "@/components/RooklineMark";
import { moveSoundsEnabled, setMoveSoundsEnabled } from "@/lib/chess/sound";
import { createPreferenceSync } from "@/lib/profile/preference-sync";
import { readTheme, writeTheme } from "@/lib/profile/theme";

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
  { href: "/friends", title: "Friends", icon: Users },
  { href: "/tournaments", title: "Tournaments", icon: Users },
  { href: "/settings", title: "Settings", icon: Settings },
];
const allDestinations = [...navigation, ...extra];
const dockDestinations = navigation.filter(({ href }) => href !== "/analysis");

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [light, setLight] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeMoreMenu = () => {
    setMoreOpen(false);
    requestAnimationFrame(() => moreButtonRef.current?.focus());
  };
  useEffect(() => {
    if (moreOpen) closeMenuRef.current?.focus();
  }, [moreOpen]);
  useEffect(() => {
    const client = browserSupabase();
    if (!client) return;
    const auth = createAuthBootstrap(setAccount);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      auth.onEvent(event, session?.user.email ?? null);
    });
    void client.auth.getUser().then(({ data }) => auth.onVerified(data.user?.email ?? null)).catch(() => auth.onVerified(null));
    return () => { auth.dispose(); subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const client = browserSupabase();
    if (!client) return;
    let applyingRemote = false;
    const sync = createPreferenceSync({
      request: fetch,
      readLocal: () => ({
        theme: readTheme(),
        sounds_enabled: moveSoundsEnabled(),
      }),
      applyRemote: (preferences) => {
        applyingRemote = true;
        try {
          writeTheme(preferences.theme);
          setMoveSoundsEnabled(preferences.sounds_enabled, false);
          window.dispatchEvent(new Event("rookline:preferences-changed"));
        } finally { applyingRemote = false; }
      },
      onStatus: (status) => {
        document.documentElement.dataset.rooklinePreferenceSync = status;
        window.dispatchEvent(new Event("rookline:preferences-sync"));
      },
    });
    const localChange = () => { if (!applyingRemote) sync.localChanged(); };
    window.addEventListener("rookline:preferences-changed", localChange);
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      void sync.setAccount(session?.user.id ?? null);
    });
    return () => {
      sync.dispose();
      subscription.unsubscribe();
      window.removeEventListener("rookline:preferences-changed", localChange);
    };
  }, []);
  async function signOut() {
    await browserSupabase()?.auth.signOut();
    setAccount(null);
    router.push("/login");
    router.refresh();
  }
  useEffect(() => {
    const syncTheme = () => {
      const isLight = readTheme() === "light";
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
    writeTheme(next ? "light" : "dark");
    document.documentElement.classList.toggle("theme-light", next);
    setLight(next);
    window.dispatchEvent(new Event("rookline:preferences-changed"));
  };
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const navLink = ({ href, title, icon: Icon }: (typeof navigation)[number]) => (
    <Link key={href} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`} aria-current={isActive(href) ? "page" : undefined} title={title} onClick={() => setMoreOpen(false)}>
      <Icon size={19} aria-hidden="true" /><span>{title}</span>
    </Link>
  );
  const activeDestination = allDestinations.find(({ href }) => isActive(href) && href !== "/")?.title ?? "Overview";
  return (
    <div className="app-frame">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Site navigation">
        <div className="sidebar-intro"><Link href="/" className="brand"><RooklineMark /><span>rookline</span></Link><p>THE CHESS STUDIO</p></div>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="nav-stack" aria-label="Primary navigation">{navigation.map(navLink)}</nav>
        <p className="nav-heading">THE CLUB</p>
        <nav className="nav-stack secondary" aria-label="More pages">{extra.map(navLink)}</nav>
        <div className="sidebar-foot"><span className="sidebar-foot-kicker">YOUR NEXT MOVE</span><strong>Ready for a game?</strong><Link href="/play" className="sidebar-foot-link">Choose a board <ArrowRight size={15} aria-hidden="true" /></Link><small>PLAY. LEARN. REPEAT. / 2026</small></div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-context"><span className="topbar-kicker">ROOKLINE / STUDIO</span><span className="topbar-label"><ChevronRight size={14} aria-hidden="true" /> {activeDestination}</span></div>
          <Link href="/" className="mobile-brand" aria-label="Rookline home"><RooklineMark size={32} /><span>rookline</span></Link>
          <div className="topbar-right">
            <Link className="btn topbar-play" href="/play/online"><ChartNoAxesCombined size={17} /> <span>Online play</span><ArrowRight size={15} aria-hidden="true" /></Link>
            <button type="button" className="icon-btn" aria-label={light ? "Use dark theme" : "Use light theme"} title="Toggle theme" onClick={toggleTheme}>{light ? <Moon size={19} /> : <Sun size={19} />}</button>
            {account ? <><span className="account-name" title={account}><UserRound size={15} /> {account}</span><button type="button" className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={19} /></button></> : <><Link href="/register" className="btn ghost account-register">Create account</Link><Link href="/login" className="icon-btn" title="Sign in" aria-label="Sign in"><LogIn size={19} /></Link></>}
          </div>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
      <nav className="mobile-dock" aria-label="Mobile navigation">
        {dockDestinations.map(({ href, title, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`dock-link ${isActive(href) ? "active" : ""}`} onClick={() => setMoreOpen(false)}><Icon size={21} aria-hidden="true" /><span>{title}</span></Link>)}
        <button ref={moreButtonRef} type="button" className={`dock-link ${moreOpen || ["/analysis", ...extra.map(({ href }) => href)].some(isActive) ? "active" : ""}`} aria-label="More pages" aria-expanded={moreOpen} aria-controls="mobile-more-panel" onClick={() => setMoreOpen(true)}><Menu size={21} aria-hidden="true" /><span>More</span></button>
      </nav>
      {moreOpen && <div className="mobile-menu-layer"><button type="button" className="mobile-menu-backdrop" aria-label="Close navigation" onClick={closeMoreMenu} /><div className="mobile-menu" id="mobile-more-panel" role="dialog" aria-modal="true" aria-label="More pages" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeMoreMenu(); }
        if (event.key !== "Tab") return;
        const focusables = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
        if (focusables.length === 0) return;
        if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1)?.focus(); }
        if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus(); }
      }}><div className="mobile-menu-title"><div><p className="overline">THE WHOLE STUDIO</p><h2>Explore Rookline.</h2></div><button ref={closeMenuRef} type="button" className="icon-btn" aria-label="Close menu" onClick={closeMoreMenu}><X size={20} /></button></div><nav className="mobile-menu-links" aria-label="More destinations">{[navigation[3], ...extra].map(navLink)}</nav></div></div>}
    </div>
  );
}
