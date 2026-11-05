'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { createAuthBootstrap } from '@/lib/supabase/auth-bootstrap';

type Tournament = {
  id: string; title: string; description: string; organizerId: string; startsAt: string;
  capacity: number; entries: number; joined: boolean; status: 'registration' | 'cancelled';
};
type Listing = { accountId: string; tournaments: Tournament[] };

export function TournamentCenter() {
  const [account, setAccount] = useState<string | null>(null);
  const active = useRef<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const refresh = () => setCurrentTime(Date.now());
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function load(id: string) {
    try {
      const response = await fetch('/api/tournaments', { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json();
      if (active.current !== id) return;
      if (!response.ok || payload.accountId !== id) throw new Error(payload.error || 'Unable to load events');
      setListing(payload as Listing);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Tournament service unavailable');
    }
  }

  useEffect(() => {
    const client = browserSupabase();
    if (!client) { queueMicrotask(() => setMessage('Connect Supabase to host tournaments.')); return; }
    let alive = true;
    function activate(id: string | null) {
      if (!alive || id === active.current) return;
      active.current = id;
      setAccount(id);
      setListing(null);
      setMessage('');
      setBusy(false);
      if (id) void load(id);
    }
    const auth = createAuthBootstrap(activate);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => auth.onEvent(event, session?.user.id ?? null));
    void client.auth.getUser().then(({ data }) => auth.onVerified(data.user?.id ?? null)).catch(() => auth.onVerified(null));
    return () => { alive = false; auth.dispose(); active.current = null; subscription.unsubscribe(); };
  }, []);

  async function submit(payload: object) {
    const id = active.current;
    if (!id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const user = await browserSupabase()?.auth.getUser();
      if (user?.data.user?.id !== id || active.current !== id) throw new Error('Account changed; reload tournaments');
      const response = await fetch('/api/tournaments', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': id },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (active.current !== id) return;
      if (!response.ok) throw new Error(result.error || 'Tournament could not be updated');
      if ('tournamentId' in result) {
        setTitle(''); setDescription(''); setStartsAt('');
      }
      setMessage('tournamentId' in result ? 'Tournament registration opened.' : `Tournament: ${result.status}.`);
      await load(id);
    } catch (error) {
      if (active.current === id) setMessage(error instanceof Error ? error.message : 'Tournament service unavailable');
    } finally { if (active.current === id) setBusy(false); }
  }

  if (!account) return <section className="text-panel stack"><h2>Sign in to participate.</h2>
    <p className="muted">Create upcoming events and reserve your place on an event roster.</p>
    <Link className="btn primary" href="/login?next=%2Ftournaments">Sign in</Link>
    {message && <p role="status">{message}</p>}</section>;

  return <div className="stack">
    <section className="text-panel stack">
      <h2>Host an event</h2>
      <p className="muted">New events accept registrations. Tournament pairings, rounds and rated prizes will be enabled after the competitive game pipeline is verified.</p>
      <form className="form-layout" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!startsAt) return;
        void submit({ action: 'create', title, description, startsAt: new Date(startsAt).toISOString(), capacity });
      }}>
        <label className="label">Event name<input className="field" required minLength={4} maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="label">Description<textarea className="field" maxLength={400} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="label">Start date and time<input className="field" type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label className="label">Player limit<select className="field" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>
          {[4,8,16,32,64].map((limit) => <option key={limit} value={limit}>{limit} players</option>)}
        </select></label>
        <button className="btn primary" disabled={busy} type="submit">Open registration</button>
      </form>
    </section>
    {message && <p className="status" role="status">{message}</p>}
    <section className="stack" aria-label="Upcoming tournaments"><h2>Upcoming registrations</h2>
      {listing?.tournaments.length === 0 && <p className="muted">No upcoming events yet.</p>}
      {!listing && <p className="muted">Loading event registrations…</p>}
      {listing?.tournaments.map((event) => {
        const closed = event.status !== 'registration' || currentTime === 0 || Date.parse(event.startsAt) - 15 * 60_000 <= currentTime;
        return <article className="text-panel stack" key={event.id}>
          <div><p className="overline">{event.status === 'cancelled' ? 'Cancelled' : 'Registration only'}</p>
            <h3 className="panel-title">{event.title}</h3>
            <p className="muted">{event.description || 'An upcoming Rookline chess event.'}</p></div>
          <p className="status">Starts {new Date(event.startsAt).toLocaleString()} · {event.entries}/{event.capacity} registered{event.joined ? ' · You are registered' : ''}</p>
          <div className="game-actions">
            {event.joined && !closed && <button className="btn ghost" disabled={busy} onClick={() => void submit({ action: 'leave', tournamentId: event.id })}>Leave event</button>}
            {!event.joined && !closed && <button className="btn primary" disabled={busy || event.entries >= event.capacity} onClick={() => void submit({ action: 'join', tournamentId: event.id })}>Join event</button>}
            {account === event.organizerId && !closed && <button className="btn ghost" disabled={busy} onClick={() => void submit({ action: 'cancel', tournamentId: event.id })}>Cancel event</button>}
            {closed && <span className="muted">Registration closed</span>}
          </div>
        </article>;
      })}
    </section>
  </div>;
}
