"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { googleOAuthCallbackUrl } from "@/lib/supabase/google-oauth";
import { safeNext } from "@/lib/online/redirect";

export function AuthForm({ mode, next, confirmationError = false, googleError = false }: { mode: "login" | "register"; next?: string; confirmationError?: boolean; googleError?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const client = browserSupabase();
  const destination = safeNext(next);
  const isRegister = mode === "register";
  const confirmationRedirect = typeof window === "undefined" ? "" : `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;

  useEffect(() => {
    if (!resendAvailableAt) return;
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)));
    const interval = window.setInterval(update, 1000);
    update();
    return () => window.clearInterval(interval);
  }, [resendAvailableAt]);

  async function resendConfirmation() {
    if (!client || busy || !email.trim() || Date.now() < resendAvailableAt) return;
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const { error } = await client.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationRedirect } });
      if (error) throw error;
      setResendAvailableAt(Date.now() + 60_000);
      setMessage("If your account needs confirmation, a new verification email has been requested. Check your inbox and spam folder.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not resend verification email.");
    } finally {
      setBusy(false);
    }
  }
  async function signInWithGoogle() {
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: googleOAuthCallbackUrl(window.location.origin, destination) },
      });
      if (error) throw error;
      // The Supabase browser client navigates to Google automatically.
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in. Please try again.");
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    if (isRegister && !displayName.trim()) { setMessage("Enter a display name."); setMessageIsError(true); return; }
    if (isRegister && password !== confirmPassword) { setMessage("Passwords do not match."); setMessageIsError(true); return; }
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      if (isRegister) {
        const { data, error } = await client.auth.signUp({ email, password, options: {
          data: { display_name: displayName.trim().slice(0, 80) },
          emailRedirectTo: confirmationRedirect,
        } });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email and open the confirmation link. If it doesn't arrive, use Resend verification email below.");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.assign(destination);
    } catch (error) {
      setMessageIsError(true);
      const detail = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      setMessage(/email not confirmed/i.test(detail) ? "Email not confirmed. Check your inbox or resend the verification email below." : detail);
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
        {isRegister && <label className="label">Confirm password<input className="field" type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>}
        <button type="submit" disabled={busy} className="btn primary">{busy ? "Working…" : isRegister ? "Create account" : "Sign in"}</button>
      </form>}
    {client && <div className="stack" style={{ gap: 8 }}>
      <p className="panel-sub" style={{ textAlign: "center" }}>Or use your Google account</p>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void signInWithGoogle()}>
        Continue with Google
      </button>
    </div>}
    {(message || confirmationError || googleError) && <p className="status" role={messageIsError || (!message && (confirmationError || googleError)) ? "alert" : "status"}>{message || (googleError ? "Google sign-in was canceled or could not be completed. Please try again." : "The confirmation link is invalid or has expired. Please sign in or create a new account.")}</p>}
    {client && <div className="stack" style={{ gap: 8 }}>
      <p className="panel-sub">Need to confirm your account? Enter your email above, then request a new link.</p>
      <button type="button" className="btn ghost" onClick={() => void resendConfirmation()} disabled={busy || !email.trim() || remainingSeconds > 0}>
        {remainingSeconds > 0 ? `Resend available in ${remainingSeconds}s` : "Resend verification email"}
      </button>
    </div>}
    <p className="muted">{isRegister ? "Already have an account?" : "New here?"} <Link href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(destination)}`} style={{ textDecoration: "underline" }}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
