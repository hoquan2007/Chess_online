'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { checkedKingSquare } from '@/lib/chess/rules';
import { parseSpectatorSnapshot, spectatorReplay, type SpectatorSnapshot } from '@/lib/online/spectators';
import { browserSupabase } from '@/lib/supabase/client';

type LoadStatus = 'loading' | 'ready' | 'login' | 'private' | 'unavailable';

function clockText(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function SpectatorBoard({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<SpectatorSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [flipped, setFlipped] = useState(false);
  // null tracks the latest verified server position; a number pins a historical ply.
  const [selectedPly, setSelectedPly] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [sampledAt, setSampledAt] = useState(() => performance.now());
  const sequence = useRef(0);
  const controllers = useRef(new Set<AbortController>());

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    for (const old of controllers.current) old.abort();
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(`/api/games/${id}/spectators`, {
        cache: 'no-store', signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (controller.signal.aborted || current !== sequence.current) return;
      const valid = response.ok ? parseSpectatorSnapshot(body, id) : null;
      if (valid) {
        setSnapshot(valid);
        setSampledAt(performance.now());
        setNow(performance.now());
        setStatus('ready');
      } else {
        // A revoked invitation or unverifiable transport must immediately hide the last board.
        setSnapshot(null);
        setSelectedPly(null);
        setStatus(response.status === 401 ? 'login' : response.status === 404 ? 'private' : 'unavailable');
      }
    } catch {
      if (!controller.signal.aborted && current === sequence.current) {
        setSnapshot(null);
        setSelectedPly(null);
        setStatus('unavailable');
      }
    } finally { controllers.current.delete(controller); }
  }, [id]);

  useEffect(() => {
    const pending = controllers.current;
    const sequenceRef = sequence;
    const initial = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => void refresh(), 3000);
    const tick = window.setInterval(() => setNow(performance.now()), 250);
    const onFocus = () => void refresh();
    const onOffline = () => { sequence.current++; for (const c of pending) c.abort(); setSnapshot(null); setSelectedPly(null); setStatus('unavailable'); };
    const client = browserSupabase();
    let previousAccount: string | null | undefined;
    let authRefreshTimer: number | null = null;
    const { data: { subscription } } = client?.auth.onAuthStateChange((event, session) => {
      const account = session?.user.id ?? null;
      if (event === 'INITIAL_SESSION') { previousAccount = account; return; }
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      if (event !== 'USER_UPDATED' && account === previousAccount) return;
      previousAccount = account;
      // An account switch must hide the previously authorized private board
      // immediately, including requests that began under the old session.
      sequenceRef.current++;
      for (const pendingRequest of pending) pendingRequest.abort();
      setSnapshot(null);
      setSelectedPly(null);
      setStatus('loading');
      // Supabase auth callbacks hold an internal lock; refresh after they exit.
      if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer);
      authRefreshTimer = window.setTimeout(() => {
        authRefreshTimer = null;
        void refresh();
      }, 0);
    }) ?? { data: { subscription: null } };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('offline', onOffline);
    return () => {
      sequenceRef.current++;
      window.clearTimeout(initial);
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('offline', onOffline);
      subscription?.unsubscribe();
      if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer);
      for (const c of pending) c.abort();
      pending.clear();
    };
  }, [refresh]);

  const timeline = useMemo(() => snapshot ? spectatorReplay(snapshot.game) : null, [snapshot]);
  const livePly = timeline ? timeline.moves.length : 0;
  const viewingPly = selectedPly === null ? livePly : Math.min(selectedPly, livePly);
  const chess = useMemo(() => timeline ? new Chess(timeline.positions[viewingPly]) : null, [timeline, viewingPly]);
  if (!snapshot || status !== 'ready' || !chess) {
    return <section className="text-panel stack" aria-label="Spectator room">
      <h1 className="page-title">Watch a game</h1>
      <p role="status" className="muted">{status === 'loading' ? 'Checking spectator access…' :
        status === 'login' ? 'Sign in to watch this game.' :
        status === 'private' ? 'The game is private, not found, or spectator permission was revoked.' :
        'The verified live board is temporarily unavailable.'}</p>
      <div className="game-actions">
        {status === 'login' && <Link className="btn primary" href={`/login?next=${encodeURIComponent(`/watch/${id}`)}`}>Sign in</Link>}
        <button className="btn ghost" type="button" onClick={() => void refresh()}>Try again</button>
        <Link className="btn ghost" href="/play/online">Online games</Link>
      </div>
    </section>;
  }

  const game = snapshot.game;
  const last = viewingPly > 0 ? timeline!.moves[viewingPly - 1] : null;
  const checked = checkedKingSquare(chess);
  const reviewing = selectedPly !== null && viewingPly < livePly;
  const style: Record<string, React.CSSProperties> = {};
  if (last) {
    style[last.from] = { boxShadow: 'inset 0 0 0 3px var(--color-accent)' };
    style[last.to] = { boxShadow: 'inset 0 0 0 3px var(--color-accent)' };
  }
  if (checked) style[checked] = { backgroundColor: '#d94a43' };
  const serverNow = snapshot.serverNow + Math.max(0, now - sampledAt);
  const remaining = (color: 'w' | 'b') => {
    const initial = color === 'w' ? game.white_ms : game.black_ms;
    if (game.status !== 'active' || game.turn !== color || !game.clock_anchor_at) return initial;
    return Math.max(0, initial - Math.max(0, serverNow - Date.parse(game.clock_anchor_at)));
  };
  const top = flipped ? 'w' : 'b';
  const bottom = flipped ? 'b' : 'w';
  const player = (color: 'w' | 'b') => <div className="player-strip">
    <span className="player-name">{color === 'w' ? 'White' : 'Black'}</span>
    <span className={`clock ${game.status === 'active' && game.turn === color ? 'running' : ''}`} aria-label={`${color === 'w' ? 'White' : 'Black'} spectator clock`}>
      {clockText(remaining(color))}
    </span>
  </div>;

  return <section className="stack" aria-label="Spectator room">
    <div><p className="overline">Rookline · Unrated · Read-only spectator</p>
      <h1 className="page-title">Live game</h1>
      <p className="muted">{game.status === 'completed' ? `Finished · ${game.result ?? 'Game over'}` : `${game.turn === 'w' ? 'White' : 'Black'} to move`} · {game.ply} half-moves</p></div>
    <div className="game-grid">
      <section className="board-shell" aria-label="Read-only spectator chessboard">
        {player(top)}
        <div className="board-wrap"><Chessboard options={{ id: `rookline-watch-${id}`, position: chess.fen(),
          boardOrientation: flipped ? 'black' : 'white', allowDragging: false,
          lightSquareStyle: { backgroundColor: 'var(--board-light)' }, darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          boardStyle: { width: '100%', height: '100%' }, squareStyles: style,
          animationDurationInMs: 180,
        }} /></div>
        {checked && <p className="check-indicator" role="status">{chess.turn() === 'w' ? 'White' : 'Black'} king in {chess.isCheckmate() ? 'checkmate' : 'check'}</p>}
        {player(bottom)}
      </section>
      <aside className="game-panel" aria-label="Spectator controls">
        <h2 className="panel-title">Watching only</h2>
        <p className="panel-sub">Both players agreed to share this board. Either can close access at any time; the live position will then disappear.</p>
        <p className="panel-sub">{Math.round(game.base_ms / 60000)}+{Math.round(game.increment_ms / 1000)} · Unrated</p>
        <p className="panel-sub" role="status" aria-label="Spectator replay position">{reviewing ? `Reviewing move ${viewingPly} of ${livePly} · live updates continue` : `Live position · ${livePly} moves`}</p>
        <div className="game-actions" aria-label="Spectator replay controls">
          <button className="btn ghost" type="button" disabled={viewingPly === 0} onClick={() => setSelectedPly(0)}>First move</button>
          <button className="btn ghost" type="button" disabled={viewingPly === 0} onClick={() => setSelectedPly(viewingPly - 1)}>Previous move</button>
          <button className="btn ghost" type="button" disabled={viewingPly === livePly} onClick={() => setSelectedPly(viewingPly + 1 === livePly ? null : viewingPly + 1)}>Next move</button>
          <button className="btn ghost" type="button" disabled={!reviewing} onClick={() => setSelectedPly(null)}>Return to live</button>
        </div>
        <div className="moves" aria-label="Spectator move history">{timeline!.moves.length === 0 ? <p className="panel-sub">Moves will appear here.</p> :
          Array.from({ length: Math.ceil(timeline!.moves.length / 2) }, (_, index) => <div className="move-row" key={index}>
            <span>{index + 1}.</span>
            {timeline!.moves.slice(index * 2, index * 2 + 2).map((move, offset) => {
              const ply = index * 2 + offset + 1;
              return <button className="spectator-move" type="button" key={ply} aria-pressed={ply === viewingPly} aria-label={`Move ${ply}: ${move.san}`} onClick={() => setSelectedPly(ply === livePly ? null : ply)}>{move.san}</button>;
            })}
          </div>)}</div>
        <div className="game-actions">
          <button className="btn ghost" type="button" onClick={() => setFlipped((value) => !value)}>Flip board</button>
          <button className="btn ghost" type="button" onClick={() => void refresh()}>Sync</button>
          <Link className="btn ghost" href="/play/online">Online games</Link>
        </div>
        <p className="panel-sub">Clocks always show the latest server estimate, including during replay.</p>
      </aside>
    </div>
  </section>;
}
