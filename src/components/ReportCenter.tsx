'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { createAuthBootstrap } from '@/lib/supabase/auth-bootstrap';

type Report = { id: number; category: string; status: string; created_at: string };

export function ReportCenter() {
  const active = useRef<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState('harassment');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load(id: string) {
    try {
      const response = await fetch('/api/reports', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (active.current !== id) return;
      if (!response.ok || result.accountId !== id) throw new Error(result.error || 'Unable to load reports');
      setReports(result.reports as Report[]);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Reports unavailable');
    }
  }

  useEffect(() => {
    const client = browserSupabase();
    if (!client) { queueMicrotask(() => setMessage('Connect Supabase to submit a report.')); return; }
    let alive = true;
    const activate = (id: string | null) => {
      if (!alive || active.current === id) return;
      active.current = id; setAccount(id); setReports([]); setMessage(''); setBusy(false);
      if (id) void load(id);
    };
    const auth = createAuthBootstrap(activate);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => auth.onEvent(event, session?.user.id ?? null));
    void client.auth.getUser().then(({ data }) => auth.onVerified(data.user?.id ?? null)).catch(() => auth.onVerified(null));
    return () => { alive = false; auth.dispose(); active.current = null; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = active.current;
    if (!id || busy) return;
    setBusy(true); setMessage('');
    try {
      const user = await browserSupabase()?.auth.getUser();
      if (user?.data.user?.id !== id || active.current !== id) throw new Error('Account changed; reload reports');
      const response = await fetch('/api/reports', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': id },
        body: JSON.stringify({ username: username.trim(), category, details }),
      });
      const result = await response.json();
      if (active.current !== id) return;
      if (!response.ok) throw new Error(result.error || 'Report could not be submitted');
      setMessage(`Report #${result.reportId} received for review.`);
      setUsername(''); setDetails('');
      await load(id);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Report unavailable');
    } finally { if (active.current === id) setBusy(false); }
  }

  if (!account) return <section className="text-panel stack"><h2>Sign in to report a player.</h2>
    <p className="muted">Reports are private and reviewed by authorized moderators.</p>
    <Link className="btn primary" href="/login?next=%2Freport">Sign in</Link>
    {message && <p role="status">{message}</p>}</section>;
  return <div className="stack">
    <form className="text-panel form-layout" onSubmit={(event) => void submit(event)}>
      <h2>Submit a confidential report</h2>
      <label className="label">Player username<input className="field" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}"
        value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} /></label>
      <label className="label">Reason<select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="harassment">Harassment</option><option value="spam">Spam</option>
        <option value="cheating">Cheating concern</option><option value="other">Other</option>
      </select></label>
      <label className="label">What happened?<textarea className="field" rows={5} required minLength={20} maxLength={500}
        value={details} onChange={(event) => setDetails(event.target.value)} /></label>
      <p className="muted">Reports are reviewed privately. Submitting a report does not automatically restrict another player.</p>
      <button type="submit" className="btn primary" disabled={busy}>Submit report</button>
    </form>
    {message && <p className="status" role="status">{message}</p>}
    <section className="text-panel stack" aria-label="Your reports"><h2>Your recent reports</h2>
      {!reports.length && <p className="muted">No reports submitted with this account.</p>}
      {reports.map((report) => <p className="status" key={report.id}>#{report.id} · {report.category} · {report.status} · {new Date(report.created_at).toLocaleDateString()}</p>)}
    </section>
  </div>;
}
