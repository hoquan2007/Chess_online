"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseProfileEdit } from "@/lib/profile/edit";

export function ProfileEditor({ initialUsername, initialDisplayName }: { initialUsername: string; initialDisplayName: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const edit = parseProfileEdit({ username, display_name: displayName });
    if (!edit.ok) { setError(true); setMessage(edit.error); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit.value),
      });
      const result: { error?: string; profile?: { username: string; display_name: string } } = await response.json();
      if (!response.ok || !result.profile) throw new Error(result.error || "Unable to save your profile");
      setError(false);
      setMessage("Profile saved.");
      setUsername(result.profile.username);
      setDisplayName(result.profile.display_name);
      if (result.profile.username !== initialUsername) {
        router.replace(`/profile/${encodeURIComponent(result.profile.username)}`);
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Unable to save your profile");
    } finally {
      setBusy(false);
    }
  }

  return <div className="text-panel stack"><div><h2>Edit your profile</h2>
    <p className="muted">Your public username and display name appear on your player page. Changing your username changes its link.</p></div>
    <form className="form-layout" onSubmit={submit}>
      <label className="label">Username<input className="field" name="username" value={username} required minLength={3} maxLength={24}
        pattern="[A-Za-z0-9_]{3,24}" autoComplete="nickname" onChange={(event) => setUsername(event.target.value)} /></label>
      <label className="label">Display name<input className="field" name="display_name" value={displayName} required maxLength={80}
        onChange={(event) => setDisplayName(event.target.value)} /></label>
      <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
    {message && <p className="status" role={error ? "alert" : "status"}>{message}</p>}
  </div>;
}
