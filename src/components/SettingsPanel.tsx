"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { moveSoundsEnabled, setMoveSoundsEnabled } from "@/lib/chess/sound";

export function SettingsPanel() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sounds, setSounds] = useState(true);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    const refreshPreferences = () => {
      setTheme(localStorage.getItem("rookline-theme") === "light" ? "light" : "dark");
      setSounds(moveSoundsEnabled());
    };
    const refreshStatus = () => setSyncStatus(document.documentElement.dataset.rooklinePreferenceSync ?? "local");
    queueMicrotask(() => { refreshPreferences(); refreshStatus(); });
    window.addEventListener("rookline:preferences-changed", refreshPreferences);
    window.addEventListener("rookline:preferences-sync", refreshStatus);
    return () => {
      window.removeEventListener("rookline:preferences-changed", refreshPreferences);
      window.removeEventListener("rookline:preferences-sync", refreshStatus);
    };
  }, []);

  function updateTheme(next: "dark" | "light") {
    localStorage.setItem("rookline-theme", next);
    document.documentElement.classList.toggle("theme-light", next === "light");
    window.dispatchEvent(new Event("rookline:preferences-changed"));
    setTheme(next);
  }

  function updateSounds(enabled: boolean) {
    setMoveSoundsEnabled(enabled);
    setSounds(enabled);
  }

  return <div className="stack" style={{ maxWidth: 720 }}>
    <section className="text-panel stack" aria-labelledby="appearance-heading">
      <div><h2 id="appearance-heading">Appearance</h2><p className="muted">Choose your preferred board theme.</p></div>
      <div className="game-actions" role="group" aria-label="Theme preference">
        <button type="button" className={`btn ${theme === "dark" ? "primary" : "ghost"}`}
          aria-pressed={theme === "dark"} onClick={() => updateTheme("dark")}>Dark theme</button>
        <button type="button" className={`btn ${theme === "light" ? "primary" : "ghost"}`}
          aria-pressed={theme === "light"} onClick={() => updateTheme("light")}>Light theme</button>
      </div>
    </section>
    <section className="text-panel stack" aria-labelledby="audio-heading">
      <div><h2 id="audio-heading">Board sounds</h2><p className="muted">Hear your moves, computer moves and online opponents. Sound is on by default; choose Off to mute.</p></div>
      <div className="game-actions" role="group" aria-label="Move sounds preference">
        <button type="button" className={`btn ${sounds ? "primary" : "ghost"}`}
          aria-pressed={sounds} onClick={() => updateSounds(true)}>On</button>
        <button type="button" className={`btn ${!sounds ? "primary" : "ghost"}`}
          aria-pressed={!sounds} onClick={() => updateSounds(false)}>Off</button>
      </div>
    </section>
    <p className="muted" role="status" aria-live="polite">{
      syncStatus === "saved" ? "Preferences synced to your account." :
      syncStatus === "loading" ? "Loading your account preferences…" :
      syncStatus === "saving" ? "Saving preferences to your account…" :
      syncStatus === "error" ? "Account sync unavailable. Your preferences remain on this device; change a setting to retry saving." :
      "Saved on this device. Sign in to sync preferences across devices."
    }</p>
    <div className="game-actions"><Link href="/play/local" className="btn primary">Try a local game</Link><Link href="/" className="btn ghost">Back home</Link></div>
  </div>;
}
