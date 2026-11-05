'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { createAuthBootstrap } from '@/lib/supabase/auth-bootstrap';
import { PrivateChat } from '@/components/PrivateChat';

type Player = { id: string; username: string; display_name: string };
type Connection = { user_low: string; user_high: string; requested_by: string; status: 'pending' | 'accepted'; created_at: string };
type Activity = { id: number; actor_id: string; kind: 'friend_request' | 'friend_accepted'; created_at: string; read_at: string | null };
type Inbox = { accountId: string; profiles: Player[]; connections: Connection[]; blocks: { blocked_id: string; created_at: string }[]; notifications: Activity[] };

export function FriendCenter() {
  const [account, setAccount] = useState<string | null>(null);
  const activeAccount = useRef<string | null>(null);
  const [data, setData] = useState<Inbox | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const mutationToken = useRef<number | null>(null);
  const refreshInbox = useRef<((mode: 'quiet' | 'manual') => void) | null>(null);

  useEffect(() => {
    const client = browserSupabase();
    if (!client) { queueMicrotask(() => setMessage('Connect Supabase to use friends.')); return; }
    const authenticatedClient = client;
    const versionRef = refreshVersion;
    const mutationRef = mutationToken;
    const inboxRef = refreshInbox;
    let alive = true;
    let authEpoch = 0;
    let notificationsChannel: ReturnType<typeof client.channel> | null = null;
    async function load(id: string, mode: 'initial' | 'quiet' | 'manual' = 'initial') {
      if (mutationToken.current !== null) return;
      const version = ++refreshVersion.current;
      try {
        const res = await fetch('/api/social', { credentials: 'same-origin', cache: 'no-store' });
        const payload = await res.json();
        if (!alive || activeAccount.current !== id || refreshVersion.current !== version) return;
        if (!res.ok || payload.accountId !== id) throw new Error(payload.error || 'Unable to load your social activity');
        setData(payload as Inbox);
        if (mode === 'initial') setMessage('');
        if (mode === 'manual') setMessage('Inbox refreshed');
      } catch (error) {
        if (alive && activeAccount.current === id && refreshVersion.current === version && mode !== 'quiet') {
          setMessage(error instanceof Error ? error.message : 'Social activity unavailable');
        }
      }
    }
    function refresh(mode: 'quiet' | 'manual' = 'quiet') {
      const id = activeAccount.current;
      if (id && document.visibilityState === 'visible') void load(id, mode);
    }
    refreshInbox.current = refresh;
    function activate(id: string | null) {
      if (id === activeAccount.current) return;
      const epoch = ++authEpoch;
      if (notificationsChannel) {
        void authenticatedClient.removeChannel(notificationsChannel);
        notificationsChannel = null;
      }
      refreshVersion.current++;
      mutationToken.current = null;
      activeAccount.current = id;
      setAccount(id);
      setData(null);
      setSelectedPeer(null);
      setMessage('');
      setBusy(false);
      if (id) {
        void load(id);
        // Defer channel setup outside Supabase's auth event callback/lock.
        window.setTimeout(() => {
          if (!alive || activeAccount.current !== id || authEpoch !== epoch) return;
          notificationsChannel = authenticatedClient.channel(`rookline-inbox-${id}`)
            .on('postgres_changes', {
              event: 'INSERT', schema: 'public', table: 'social_notifications', filter: `recipient_id=eq.${id}`,
            }, () => { if (activeAccount.current === id && authEpoch === epoch) refresh(); })
            .on('postgres_changes', {
              event: 'UPDATE', schema: 'public', table: 'social_notifications', filter: `recipient_id=eq.${id}`,
            }, () => { if (activeAccount.current === id && authEpoch === epoch) refresh(); })
            .subscribe((status) => {
              // Reconnect may have missed messages; refresh from the owner-only API.
              if (status === 'SUBSCRIBED' && activeAccount.current === id && authEpoch === epoch) refresh();
            });
        }, 0);
      }
    }
    const auth = createAuthBootstrap(activate);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      auth.onEvent(event, session?.user.id ?? null);
    });
    void client.auth.getUser().then(({ data: result }) => {
      auth.onVerified(result.user?.id ?? null);
    }).catch(() => auth.onVerified(null));
    const refreshWhenVisible = () => refresh();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      alive = false;
      versionRef.current++;
      mutationRef.current = null;
      inboxRef.current = null;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      if (notificationsChannel) void client.removeChannel(notificationsChannel);
      auth.dispose();
      subscription.unsubscribe();
      activeAccount.current = null;
    };
  }, []);

  async function submit(action: string, targetId?: string) {
    const id = activeAccount.current;
    if (!id || mutationToken.current !== null) return;
    const token = ++refreshVersion.current;
    mutationToken.current = token;
    setBusy(true);
    setMessage('');
    const isCurrent = () => activeAccount.current === id && mutationToken.current === token;
    try {
      const session = await browserSupabase()?.auth.getUser();
      if (session?.data.user?.id !== id || !isCurrent()) throw new Error('Account changed; please reload');
      const payload = action === 'request' || (action === 'block' && !targetId)
        ? { action, username: username.trim() }
        : action === 'mark_read' ? { action } : { action, targetId };
      const response = await fetch('/api/social', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': id },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(result.error || 'Could not update friendship');
      if (action === 'request' || action === 'block') setUsername('');
      if ((action === 'remove' || action === 'block') && targetId === selectedPeer) setSelectedPeer(null);
      setMessage(action === 'mark_read' ? 'Notifications marked as read' : `Connection: ${result.status}`);
    } catch (error) {
      if (isCurrent()) setMessage(error instanceof Error ? error.message : 'Unable to update');
    } finally {
      if (isCurrent()) {
        mutationToken.current = null;
        setBusy(false);
        refreshInbox.current?.('quiet');
      }
    }
  }

  const profiles = new Map((data?.profiles ?? []).map((profile) => [profile.id, profile]));
  const player = (id: string) => profiles.get(id)?.display_name || profiles.get(id)?.username || 'Player';
  const other = (row: Connection) => row.user_low === account ? row.user_high : row.user_low;
  const accepted = (data?.connections ?? []).filter((row) => row.status === 'accepted');
  const incoming = (data?.connections ?? []).filter((row) => row.status === 'pending' && row.requested_by !== account);
  const outgoing = (data?.connections ?? []).filter((row) => row.status === 'pending' && row.requested_by === account);
  const unread = (data?.notifications ?? []).filter((row) => !row.read_at).length;

  if (!account) return <div className="text-panel stack"><h2>Friends require an account.</h2>
    <p className="muted">Sign in to send requests, manage blocks and read private notifications.</p>
    <Link className="btn primary" href="/login?next=%2Ffriends">Sign in</Link>{message && <p role="status">{message}</p>}</div>;

  return <div className="stack">
    <form className="text-panel stack" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit('request'); }}>
      <h2>Find a player</h2>
      <label htmlFor="friend-username">Exact Rookline username</label>
      <input id="friend-username" className="field-input" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())}
        minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" autoComplete="off" required />
      <div className="game-actions"><button className="btn primary" disabled={busy} type="submit">Send friend request</button>
        <button className="btn ghost" disabled={busy || !username} type="button" onClick={() => void submit('block')}>Block username</button></div>
    </form>
    {message && <p className="status" role="status">{message}</p>}
    <section className="text-panel stack" aria-labelledby="friends-title"><h2 id="friends-title">Friends ({accepted.length})</h2>
      {!accepted.length && <p className="muted">Accepted friends will appear here.</p>}
      {accepted.map((row) => <div className="status" key={other(row)} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>{player(other(row))}</span><div className="game-actions"><button className="btn ghost" disabled={busy} onClick={() => setSelectedPeer(other(row))}>Message</button>
          <button className="btn ghost" disabled={busy} onClick={() => void submit('remove', other(row))}>Remove</button>
          <button className="btn ghost" disabled={busy} onClick={() => void submit('block', other(row))}>Block</button></div></div>)}
    </section>
    {account && selectedPeer && accepted.some((row) => other(row) === selectedPeer) &&
      <PrivateChat key={`${account}:${selectedPeer}`} accountId={account} peerId={selectedPeer}
        peerName={player(selectedPeer)} isCurrent={() => activeAccount.current === account}
        onClose={() => setSelectedPeer(null)} />}
    <section className="text-panel stack" aria-labelledby="requests-title"><h2 id="requests-title">Requests ({incoming.length} received · {outgoing.length} sent)</h2>
      {!incoming.length && !outgoing.length && <p className="muted">No pending requests.</p>}
      {incoming.map((row) => <div className="status" key={other(row)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>{player(other(row))} wants to connect</span><div className="game-actions">
          <button disabled={busy} className="btn primary" onClick={() => void submit('accept', other(row))}>Accept</button>
          <button disabled={busy} className="btn ghost" onClick={() => void submit('decline', other(row))}>Decline</button>
          <button disabled={busy} className="btn ghost" onClick={() => void submit('block', other(row))}>Block</button></div></div>)}
      {outgoing.map((row) => <div className="status" key={other(row)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Waiting for {player(other(row))}</span><button disabled={busy} className="btn ghost" onClick={() => void submit('remove', other(row))}>Withdraw</button></div>)}
    </section>
    <section className="text-panel stack" aria-labelledby="inbox-title"><h2 id="inbox-title">Notifications ({unread} unread)</h2>
      <p className="muted">Updates on new activity and when you return, with a 30-second refresh fallback while this tab is visible.</p>
      <div className="game-actions"><button className="btn ghost" disabled={busy} onClick={() => refreshInbox.current?.('manual')}>Refresh inbox</button>
        <button className="btn ghost" disabled={busy || !unread} onClick={() => void submit('mark_read')}>Mark all read</button></div>
      {!data?.notifications.length && <p className="muted">Your private inbox is empty.</p>}
      {data?.notifications.map((item) => <p className="status" key={item.id}>{item.read_at ? '' : '● '}{player(item.actor_id)} {item.kind === 'friend_request' ? 'sent a friend request.' : 'accepted your request.'}</p>)}
    </section>
    <section className="text-panel stack" aria-labelledby="blocks-title"><h2 id="blocks-title">Blocked players</h2>
      {!data?.blocks.length && <p className="muted">No blocked accounts.</p>}
      {data?.blocks.map((row) => <div className="status" key={row.blocked_id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>{player(row.blocked_id)}</span><button disabled={busy} className="btn ghost" onClick={() => void submit('unblock', row.blocked_id)}>Unblock</button></div>)}
    </section>
  </div>;
}
