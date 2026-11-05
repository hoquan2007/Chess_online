import {
  calculateRoundRobinStandings,
  createRoundRobinPlan,
  type MatchResult,
  type RoundRobinPlan,
} from './tournament-rounds';

/** Portable, explicitly unrated browser draft. Never use imported results as hosted game authority. */
export const maxTournamentDraftBytes = 16 * 1024;
const format = 'rookline.round-robin-practice';
const version = 1;

export type TournamentDraft = {
  plan: RoundRobinPlan;
  results: Record<string, MatchResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateResults(plan: RoundRobinPlan, value: unknown): Record<string, MatchResult> {
  if (!isRecord(value)) throw new Error('Practice results must be a match-to-score object.');
  const matchIds = new Set(plan.rounds.flatMap((round) => round.matches.map((match) => match.id)));
  const results: Record<string, MatchResult> = {};
  for (const [id, result] of Object.entries(value)) {
    if (!matchIds.has(id)) throw new Error('The draft contains a result for an unknown match.');
    if (result !== 'white' && result !== 'black' && result !== 'draw') {
      throw new Error('The draft contains an invalid match result.');
    }
    results[id] = result;
  }
  return results;
}

export function serializeTournamentDraft(plan: RoundRobinPlan, results: Readonly<Record<string, MatchResult>>): string {
  // Regenerate fixtures from names so files cannot become a source of trusted pairings.
  const canonical = createRoundRobinPlan(plan.players.map((player) => player.name));
  const scores = validateResults(canonical, results);
  return JSON.stringify({ format, version, players: canonical.players.map((player) => player.name), results: scores }, null, 2) + '\n';
}

export function parseTournamentDraft(input: string): TournamentDraft {
  if (typeof input !== 'string' || new TextEncoder().encode(input).byteLength > maxTournamentDraftBytes) {
    throw new Error('Practice draft exceeds the 16 KB limit.');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(input); }
  catch { throw new Error('Practice draft is not valid JSON.'); }
  if (!isRecord(parsed) || parsed.format !== format || parsed.version !== version ||
    Object.keys(parsed).sort().join(',') !== 'format,players,results,version') {
    throw new Error('Unsupported practice draft format or version.');
  }
  if (!Array.isArray(parsed.players) || !parsed.players.every((name) => typeof name === 'string')) {
    throw new Error('Practice draft has an invalid player roster.');
  }
  const plan = createRoundRobinPlan(parsed.players);
  return { plan, results: validateResults(plan, parsed.results) };
}

// Prefix spreadsheet formulas before CSV quoting. User-entered names must remain literal text.
function csvCell(value: string | number): string {
  const string = String(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(string) ? `'${string}` : string;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}

export function exportTournamentStandingsCsv(plan: RoundRobinPlan, results: Readonly<Record<string, MatchResult>>): string {
  const scores = validateResults(plan, results);
  const rows = [csvRow(['Rank', 'Player', 'Played', 'Wins', 'Draws', 'Losses', 'Points'])];
  calculateRoundRobinStandings(plan, scores).forEach((player, index) => {
    rows.push(csvRow([index + 1, player.name, player.played, player.wins, player.draws, player.losses, player.points]));
  });
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

export function exportTournamentScheduleCsv(plan: RoundRobinPlan, results: Readonly<Record<string, MatchResult>>): string {
  const scores = validateResults(plan, results);
  const rows = [csvRow(['Round', 'White', 'Black', 'Result', 'Bye'])];
  const label: Record<MatchResult, string> = { white: '1-0', draw: '1/2-1/2', black: '0-1' };
  for (const round of plan.rounds) {
    for (const match of round.matches) {
      rows.push(csvRow([round.number, plan.players[match.whiteId].name, plan.players[match.blackId].name,
        scores[match.id] === undefined ? '' : label[scores[match.id]], '']));
    }
    if (round.byeId !== null) {
      rows.push(csvRow([round.number, '', '', '', plan.players[round.byeId].name]));
    }
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
