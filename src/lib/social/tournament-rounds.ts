/** Browser-only tournament planning. These results never become rated or hosted game outcomes. */
export type RoundRobinPlayer = { id: number; name: string };
export type RoundRobinMatch = { id: string; whiteId: number; blackId: number };
export type RoundRobinRound = { number: number; matches: RoundRobinMatch[]; byeId: number | null };
export type RoundRobinPlan = { players: RoundRobinPlayer[]; rounds: RoundRobinRound[] };
export type MatchResult = 'white' | 'draw' | 'black';
export type RoundRobinStanding = RoundRobinPlayer & {
  played: number; wins: number; draws: number; losses: number; points: number;
};

export function parseRoundRobinRoster(input: string): string[] {
  if (typeof input !== 'string' || input.length > 1024) throw new Error('Roster is too long.');
  const names = input.split(/\r?\n/).map((name) => name.trim().normalize('NFC')).filter(Boolean);
  if (names.length < 4 || names.length > 16) throw new Error('Enter between 4 and 16 player names, one per line.');
  if (names.some((name) => name.length > 32)) throw new Error('Each player name must be at most 32 characters.');
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error('Every player must have a different name.');
  }
  return names;
}

/** Circle-method round robin: each pair meets once, one bye per player for odd rosters. */
export function createRoundRobinPlan(names: readonly string[]): RoundRobinPlan {
  // Apply the same validation to programmatic callers as to the text-entry UI.
  const canonical = parseRoundRobinRoster(names.join('\n'));
  if (canonical.length !== names.length) throw new Error('Blank player names are not allowed.');
  const players = canonical.map((name, id) => ({ id, name }));
  let seats: (number | null)[] = players.map((player) => player.id);
  if (seats.length % 2 === 1) seats.push(null);
  const rounds: RoundRobinRound[] = [];

  for (let index = 0; index < seats.length - 1; index += 1) {
    const matches: RoundRobinMatch[] = [];
    let byeId: number | null = null;
    for (let table = 0; table < seats.length / 2; table += 1) {
      const first = seats[table];
      const second = seats[seats.length - 1 - table];
      if (first === null || second === null) {
        byeId = first ?? second;
        continue;
      }
      // Alternate the fixed seat each round; rotate other boards' colors.
      const reverse = table === 0 ? index % 2 === 1 : table % 2 === 1;
      matches.push({
        id: `r${index + 1}-m${table + 1}`,
        whiteId: reverse ? second : first,
        blackId: reverse ? first : second,
      });
    }
    rounds.push({ number: index + 1, matches, byeId });
    seats = [seats[0], seats[seats.length - 1], ...seats.slice(1, -1)];
  }
  return { players, rounds };
}

/** Unplayed games and byes earn no points. Ties retain original roster order. */
export function calculateRoundRobinStandings(
  plan: RoundRobinPlan,
  results: Readonly<Record<string, MatchResult>>,
): RoundRobinStanding[] {
  const standings = plan.players.map((player) => ({
    ...player, played: 0, wins: 0, draws: 0, losses: 0, points: 0,
  }));
  for (const round of plan.rounds) {
    for (const match of round.matches) {
      const outcome = results[match.id];
      if (outcome !== 'white' && outcome !== 'draw' && outcome !== 'black') continue;
      const white = standings[match.whiteId];
      const black = standings[match.blackId];
      white.played += 1;
      black.played += 1;
      if (outcome === 'draw') {
        white.draws += 1;
        black.draws += 1;
        white.points += 0.5;
        black.points += 0.5;
      } else {
        const winner = outcome === 'white' ? white : black;
        const loser = outcome === 'white' ? black : white;
        winner.wins += 1;
        winner.points += 1;
        loser.losses += 1;
      }
    }
  }
  return standings.sort((a, b) => b.points - a.points || b.wins - a.wins || a.id - b.id);
}
