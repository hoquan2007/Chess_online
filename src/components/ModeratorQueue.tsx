'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { createAuthBootstrap } from '@/lib/supabase/auth-bootstrap';

type Review = {
  id: number; reporter_id: string; target_id: string;
  category: string; details: string; created_at: string;
};

export function ModeratorQueue() {
  const active = useRef<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [reports, setReports] = useState<Review[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  async function load(id: string) {
    try {
      const response = await fetch('/api/moderation', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (active.current !== id) return;
      if (response.status === 403) { setForbidden(true); setReports([]); return; }
      if (!response.ok || result.accountId !== id) throw new Error(result.error || 'Unable to load reports');
      setForbidden(false); setReports(result.reports as Review[]);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Moderator queue unavailable');
    }
  }

  useEffect(() => {
    const client = browserSupabase();
    if (!client) { queueMicrotask(() => setMessage('Moderator service unavailable.')); return; }
    let alive = true;
    const activate = (id: string | null) => {
      if (!alive || active.current === id) return;
      active.current = id; setAccount(id); setReports([]); setForbidden(false); setMessage(''); setBusy(false);
      if (id) void load(id);
    };
    const auth = createAuthBootstrap(activate);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => auth.onEvent(event, session?.user.id ?? null));
    void client.auth.getUser().then(({ data }) => auth.onVerified(data.user?.id ?? null)).catch(() => auth.onVerified(null));
    return () => { alive = false; auth.dispose(); active.current = null; subscription.unsubscribe(); };
  }, []);

  async function decide(reportId: number, decision: 'resolved' | 'dismissed') {
    const id = active.current;
    if (!id || busy) return;
    setBusy(true); setMessage('');
    try {
      const user = await browserSupabase()?.auth.getUser();
      if (user?.data.user?.id !== id || active.current !== id) throw new Error('Account changed; reload queue');
      const response = await fetch('/api/moderation', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': id },
        body: JSON.stringify({ reportId, decision }),
      });
      const result = await response.json();
      if (active.current !== id) return;
      if (!response.ok) throw new Error(result.error || 'Review was not saved');
      setMessage(`Report #${reportId} ${decision}.`);
      await load(id);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Review failed');
    } finally { if (active.current === id) setBusy(false); }
  }

  if (!account) return <section className="text-panel stack"><h2>Moderator sign-in required.</h2>
    <Link className="btn primary" href="/login?next=%2Fmoderation">Sign in</Link></section>;
  if (forbidden) return <p className="status" role="status">This account does not have moderator access.</p>;
  return <section className="stack" aria-label="Pending player reports">
    {message && <p className="status" role="status">{message}</p>}
    {!reports.length && <p className="muted">No pending reports, or the queue is still loading.</p>}
    {reports.map((report) => <article className="text-panel stack" key={report.id}>
      <div><h2>Report #{report.id} · {report.category}</h2>
        <p className="muted">Created {new Date(report.created_at).toLocaleString()}</p>
        <p className="muted">Reporter: {report.reporter_id} · Subject: {report.target_id}</p></div>
      <p className="status" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.details}</p>
      <div className="game-actions">
        <button className="btn primary" disabled={busy} onClick={() => void decide(report.id, 'resolved')}>Mark reviewed</button>
        <button className="btn ghost" disabled={busy} onClick={() => void decide(report.id, 'dismissed')}>Dismiss</button>
      </div>
    </article>)}
  </section>;
}
