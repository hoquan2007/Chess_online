'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSpectatorConsent, type SpectatorConsentState } from '@/lib/online/spectators';

export function SpectatorPermission({ gameId, accountId }: { gameId: string; accountId: string }) {
  const [state, setState] = useState<SpectatorConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());

  const load = useCallback(async () => {
    const sequence = ++generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(`/api/games/${gameId}/spectators`, {
        cache: 'no-store', signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (controller.signal.aborted || sequence !== generation.current) return;
      const parsed = response.ok ? parseSpectatorConsent(body) : null;
      setState(parsed);
      setError(parsed ? '' : response.status === 503 ? 'Spectator service is not available yet.' : 'Could not verify spectator permissions.');
    } catch {
      if (!controller.signal.aborted && sequence === generation.current) {
        setState(null);
        setError('Could not load spectator permissions.');
      }
    } finally { controllers.current.delete(controller); }
  }, [gameId]);

  useEffect(() => {
    const pending = controllers.current;
    const generationRef = generation;
    const initialize = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      generationRef.current++;
      window.clearTimeout(initialize);
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      for (const controller of pending) controller.abort();
      pending.clear();
    };
  }, [load]);

  async function update(enabled: boolean) {
    if (busy || !state) return;
    const sequence = ++generation.current;
    for (const controller of controllers.current) controller.abort();
    setBusy(true);
    setError('');
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(`/api/games/${gameId}/spectators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': accountId },
        body: JSON.stringify({ enabled }), signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (controller.signal.aborted || sequence !== generation.current) return;
      const parsed = response.ok ? parseSpectatorConsent(body) : null;
      if (!parsed) throw new Error('Could not change spectator permissions.');
      setState(parsed);
    } catch {
      if (!controller.signal.aborted && sequence === generation.current) {
        setState(null); // A failed/rejected revocation must never keep showing an open share link.
        setError('Permission status is uncertain. Refresh it before sharing.');
      }
    } finally {
      controllers.current.delete(controller);
      if (sequence === generation.current) setBusy(false);
    }
  }

  return <section className="stack" aria-label="Spectator permissions">
    <h3 className="panel-title">Spectators</h3>
    <p className="panel-sub">Both players must opt in. Either player can revoke access at any time. Watchers cannot move pieces or see account details.</p>
    {state && <>
      <label className="panel-sub"><input type="checkbox" checked={state.enabled} disabled={busy} onChange={(event) => void update(event.target.checked)} /> Allow spectators</label>
      <p className="panel-sub" role="status">{state.open ? 'Spectator link is available.' : state.enabled ? 'Waiting for the other player to agree.' : 'Spectators are disabled.'}</p>
      {state.open && <Link className="btn ghost" href={`/watch/${gameId}`}>Open watch link</Link>}
    </>}
    {error && <p role="alert" className="panel-sub">{error}</p>}
    <button type="button" className="btn ghost" disabled={busy} onClick={() => void load()}>Refresh spectator status</button>
  </section>;
}
