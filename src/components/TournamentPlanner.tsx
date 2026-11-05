'use client';

import { useMemo, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import {
  calculateRoundRobinStandings, createRoundRobinPlan, parseRoundRobinRoster,
  type MatchResult, type RoundRobinPlan,
} from '@/lib/social/tournament-rounds';
import {
  exportTournamentScheduleCsv, exportTournamentStandingsCsv, maxTournamentDraftBytes,
  parseTournamentDraft, serializeTournamentDraft,
} from '@/lib/social/tournament-draft';

function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function TournamentPlanner() {
  const [roster, setRoster] = useState('Player 1\nPlayer 2\nPlayer 3\nPlayer 4');
  const [plan, setPlan] = useState<RoundRobinPlan | null>(null);
  const [results, setResults] = useState<Record<string, MatchResult>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const importRequest = useRef(0);
  const standings = useMemo(() => plan ? calculateRoundRobinStandings(plan, results) : [], [plan, results]);
  const totalMatches = plan?.rounds.reduce((sum, round) => sum + round.matches.length, 0) ?? 0;

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    importRequest.current += 1;
    try {
      const next = createRoundRobinPlan(parseRoundRobinRoster(roster));
      setPlan(next);
      setResults({});
      setError('');
      setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid player roster.');
    }
  }

  function saveFile(filename: string, mime: string, produce: () => string) {
    try {
      download(produce(), filename, mime);
      setError('');
      setMessage(`${filename} downloaded. Keep this file to restore your practice schedule.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export the practice file.');
    }
  }

  async function restoreDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const request = ++importRequest.current;
    try {
      if (file.size > maxTournamentDraftBytes) throw new Error('Practice draft exceeds the 16 KB limit.');
      const restored = parseTournamentDraft(await file.text());
      if (request !== importRequest.current) return;
      setRoster(restored.plan.players.map((player) => player.name).join('\n'));
      setPlan(restored.plan);
      setResults(restored.results);
      setError('');
      setMessage('Practice schedule and recorded results restored from your file.');
    } catch (cause) {
      if (request !== importRequest.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not import the practice file.');
      setMessage('');
    }
  }

  return <div className="stack">
    <section className="text-panel stack">
      <div><p className="overline">Offline tournament workshop</p><h2>Round-robin planner</h2>
        <p className="muted">Build a complete color-assigned schedule and record practice results. Each player meets every other player once. Odd-sized groups receive one bye per player.</p>
      </div>
      <p className="status">Browser-only draft. Names, pairings and scores are not sent to Supabase, saved to your account, or counted as rated games. Download a draft before closing the page to keep your work.</p>
      <form className="form-layout" onSubmit={generate}>
        <label className="label" htmlFor="roster-input">Players (4–16, one name per line)</label>
        <textarea id="roster-input" className="field" rows={7} maxLength={1024} value={roster}
          onChange={(event) => { importRequest.current += 1; setRoster(event.target.value); }} spellCheck={false} />
        <button className="btn primary" type="submit">Generate rounds</button>
      </form>
      <div className="game-actions">
        <button className="btn ghost" type="button" disabled={!plan}
          onClick={() => plan && saveFile('rookline-tournament-draft.json', 'application/json', () => serializeTournamentDraft(plan, results))}>
          Download practice draft
        </button>
        <label className="btn ghost">Import practice draft
          <input className="sr-only" type="file" accept=".json,application/json"
            aria-label="Import practice draft JSON" onChange={(event) => void restoreDraft(event)} />
        </label>
      </div>
      {error && <p className="status" role="alert">{error}</p>}
      {message && <p className="muted" role="status">{message}</p>}
    </section>

    {plan && <>
      <section className="text-panel stack" aria-label="Practice standings">
        <div className="tournament-heading"><div><p className="overline">Practice only</p><h2>Standings</h2></div>
          <div className="game-actions">
            <button className="btn ghost" type="button"
              onClick={() => saveFile('rookline-standings.csv', 'text/csv;charset=utf-8', () => exportTournamentStandingsCsv(plan, results))}>
              Download standings CSV
            </button>
            <button className="btn ghost" type="button"
              onClick={() => saveFile('rookline-schedule.csv', 'text/csv;charset=utf-8', () => exportTournamentScheduleCsv(plan, results))}>
              Download schedule CSV
            </button>
            <button className="btn ghost" type="button" onClick={() => { importRequest.current += 1; setResults({}); setMessage(''); }}>Clear results</button>
          </div></div>
        <p className="muted" role="status">{Object.keys(results).length} of {totalMatches} games entered · {plan.rounds.length} rounds</p>
        <div className="tournament-table-wrap"><table className="tournament-table"><thead><tr>
          <th scope="col">#</th><th scope="col">Player</th><th scope="col">Played</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col">Points</th>
        </tr></thead><tbody>{standings.map((player, index) => <tr key={player.id}>
          <td>{index + 1}</td><th scope="row">{player.name}</th><td>{player.played}</td><td>{player.wins}</td>
          <td>{player.draws}</td><td>{player.losses}</td><td>{player.points.toFixed(1)}</td>
        </tr>)}</tbody></table></div>
        <p className="muted">1 point per win, ½ per draw; byes earn no points. Equal scores are sorted by wins, then initial player order. Official tie-breaks are not calculated.</p>
      </section>

      <section className="stack" aria-label="Round robin schedule"><h2>Schedule</h2>
        <div className="tournament-rounds">{plan.rounds.map((round) => <article className="text-panel stack" key={round.number}>
          <h3 className="panel-title">Round {round.number}</h3>
          <ol className="tournament-matches">{round.matches.map((match) => <li key={match.id}>
            <div className="tournament-match-names"><span><small>White</small>{plan.players[match.whiteId].name}</span>
              <span className="muted" aria-hidden="true">vs</span><span><small>Black</small>{plan.players[match.blackId].name}</span></div>
            <label className="label">Result
              <select className="field" aria-label={`Round ${round.number}: ${plan.players[match.whiteId].name} vs ${plan.players[match.blackId].name} result`}
                value={results[match.id] ?? ''} onChange={(event) => {
                  const value = event.target.value;
                  importRequest.current += 1;
                  setResults((previous) => {
                    const next = { ...previous };
                    if (value === '') delete next[match.id];
                    else next[match.id] = value as MatchResult;
                    return next;
                  });
                }}>
                <option value="">Not played</option><option value="white">1–0 · White wins</option>
                <option value="draw">½–½ · Draw</option><option value="black">0–1 · Black wins</option>
              </select>
            </label>
          </li>)}</ol>
          {round.byeId !== null && <p className="muted">Bye: {plan.players[round.byeId].name}</p>}
        </article>)}</div>
      </section>
    </>}
  </div>;
}
