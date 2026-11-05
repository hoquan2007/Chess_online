'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { preparePrivateChatRetry, type PrivateChatWrite } from '@/lib/social/messages';

type ChatMessage = { id: number; sender_id: string; recipient_id: string; body: string; created_at: string };
type ChatResponse = { accountId: string; peerId: string; messages: ChatMessage[]; error?: string };

export function PrivateChat({ accountId, peerId, peerName, isCurrent, onClose }: {
  accountId: string;
  peerId: string;
  peerName: string;
  isCurrent: () => boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const live = useRef(true);
  const current = useRef(isCurrent);
  const refreshVersion = useRef(0);
  const pending = useRef<PrivateChatWrite | null>(null);

  useEffect(() => { current.current = isCurrent; }, [isCurrent]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++refreshVersion.current;
    try {
      const response = await fetch(`/api/private-messages?peer=${encodeURIComponent(peerId)}`, {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      const result = await response.json() as ChatResponse;
      if (signal?.aborted || !live.current || !current.current() || version !== refreshVersion.current) return;
      if (!response.ok || result.accountId !== accountId || result.peerId !== peerId || !Array.isArray(result.messages)) {
        throw new Error(result.error || 'Unable to load conversation');
      }
      setMessages(result.messages);
      setError('');
    } catch (cause) {
      if (!signal?.aborted && live.current && current.current() && version === refreshVersion.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load conversation');
      }
    } finally {
      if (!signal?.aborted && live.current && current.current() && version === refreshVersion.current) setLoading(false);
    }
  }, [accountId, peerId]);

  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    const versionRef = refreshVersion;
    queueMicrotask(() => {
      if (!controller.signal.aborted) void refresh(controller.signal);
    });
    return () => { controller.abort(); live.current = false; versionRef.current++; };
  }, [refresh]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (busy || !isCurrent() || !content || content.length > 500) return;
    setBusy(true);
    setError('');
    try {
      const user = await browserSupabase()?.auth.getUser();
      if (user?.data.user?.id !== accountId || !live.current || !isCurrent()) {
        throw new Error('Account changed; reload messages');
      }
      const write = preparePrivateChatRetry(pending.current, peerId, content, () => crypto.randomUUID());
      pending.current = write;
      const response = await fetch('/api/private-messages', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Rookline-Account': accountId },
        body: JSON.stringify(write),
      });
      const result = await response.json();
      if (!live.current || !isCurrent()) return;
      if (!response.ok) throw new Error(result.error || 'Unable to send message');
      pending.current = null;
      setDraft('');
      await refresh();
    } catch (cause) {
      if (live.current && isCurrent()) setError(cause instanceof Error ? cause.message : 'Unable to send message');
    } finally {
      if (live.current && isCurrent()) setBusy(false);
    }
  }

  return <section className="text-panel stack" aria-label={`Private conversation with ${peerName}`}>
    <div className="game-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <h3>Private messages · {peerName}</h3>
      <div className="game-actions">
        <button className="btn ghost" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        <button className="btn ghost" type="button" onClick={onClose}>Close conversation</button>
      </div>
    </div>
    {loading && <p className="muted" role="status">Loading messages…</p>}
    {!loading && !messages.length && <p className="muted">No messages yet. Only accepted friends can exchange messages.</p>}
    <ol aria-label="Conversation history" className="stack" style={{ listStyle: 'none', padding: 0 }}>
      {messages.map((item) => <li className="status" key={item.id}>
        <strong>{item.sender_id === accountId ? 'You' : peerName}</strong>
        <span className="muted" style={{ marginLeft: 10 }}>{new Date(item.created_at).toLocaleString()}</span>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</p>
      </li>)}
    </ol>
    <form className="stack" onSubmit={(event) => void send(event)}>
      <label htmlFor="private-chat-draft">Message to {peerName}</label>
      <textarea id="private-chat-draft" className="field-input" rows={3} value={draft}
        onChange={(event) => {
          const next = event.target.value;
          if (pending.current && pending.current.body !== next.trim()) pending.current = null;
          setDraft(next);
        }} maxLength={500} required />
      <div className="game-actions"><button className="btn primary" type="submit" disabled={busy || !draft.trim()}>Send message</button>
        <span className="muted">{draft.length}/500 · 20 messages per minute</span></div>
    </form>
    {error && <p className="status" role="alert">{error}</p>}
  </section>;
}
