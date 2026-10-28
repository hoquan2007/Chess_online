"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { safeNext } from "@/lib/online/redirect";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const client = browserSupabase();
  const destination = safeNext(next);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (isRegister) {
        const { data, error } = await client.auth.signUp({ email, password, options: {
          data: { display_name: displayName.trim().slice(0, 80) },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
        } });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email for a confirmation link, then sign in.");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.assign(destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="text-panel stack" style={{ maxWidth: 560 }}>
    <div><p className="overline">Rookline account</p><h1 className="page-title">{isRegister ? "Join the board." : "Welcome back."}</h1><p className="muted">{isRegister ? "Create your chess identity and invite your first opponent." : "Sign in to resume your games."}</p></div>
    {!client ? <p role="status" className="status">Online accounts are unavailable until Supabase environment variables are configured.</p> :
      <form className="form-layout" onSubmit={submit}>
        {isRegister && <label className="label">Display name<input required maxLength={80} className="field" autoComplete="nickname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>}
        <label className="label">Email<input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="label">Password<input className="field" type="password" minLength={8} autoComplete={isRegister ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit" disabled={busy} className="btn primary">{busy ? "Working…" : isRegister ? "Create account" : "Sign in"}</button>
      </form>}
    {message && <p className="status" role="status">{message}</p>}
    <p className="muted">{isRegister ? "Already have an account?" : "New here?"} <Link href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(destination)}`} style={{ textDecoration: "underline" }}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
