"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SettingsPanel() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sounds, setSounds] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setTheme(localStorage.getItem("rookline-theme") === "light" ? "light" : "dark");
      setSounds(localStorage.getItem("rookline-sound") === "on");
    });
  }, []);

  function updateTheme(next: "dark" | "light") {
    localStorage.setItem("rookline-theme", next);
    document.documentElement.classList.toggle("theme-light", next === "light");
    window.dispatchEvent(new Event("rookline:preferences-changed"));
    setTheme(next);
  }

  function updateSounds(enabled: boolean) {
    localStorage.setItem("rookline-sound", enabled ? "on" : "off");
    window.dispatchEvent(new Event("rookline:preferences-changed"));
    setSounds(enabled);
  }

  return <div className="stack" style={{ maxWidth: 720 }}>
    <section className="text-panel stack" aria-labelledby="appearance-heading">
      <div><h2 id="appearance-heading">Appearance</h2><p className="muted">Choose a theme for this browser.</p></div>
      <div className="game-actions" role="group" aria-label="Theme preference">
        <button type="button" className={`btn ${theme === "dark" ? "primary" : "ghost"}`}
          aria-pressed={theme === "dark"} onClick={() => updateTheme("dark")}>Dark theme</button>
        <button type="button" className={`btn ${theme === "light" ? "primary" : "ghost"}`}
          aria-pressed={theme === "light"} onClick={() => updateTheme("light")}>Light theme</button>
      </div>
    </section>
    <section className="text-panel stack" aria-labelledby="audio-heading">
      <div><h2 id="audio-heading">Board sounds</h2><p className="muted">Play a move tone in local chess and computer games.</p></div>
      <div className="game-actions" role="group" aria-label="Move sounds preference">
        <button type="button" className={`btn ${sounds ? "primary" : "ghost"}`}
          aria-pressed={sounds} onClick={() => updateSounds(true)}>On</button>
        <button type="button" className={`btn ${!sounds ? "primary" : "ghost"}`}
          aria-pressed={!sounds} onClick={() => updateSounds(false)}>Off</button>
      </div>
    </section>
    <p className="muted">These preferences are saved only in this browser. Account-wide preferences require a connected online account.</p>
    <div className="game-actions"><Link href="/play/local" className="btn primary">Try a local game</Link><Link href="/" className="btn ghost">Back home</Link></div>
  </div>;
}
