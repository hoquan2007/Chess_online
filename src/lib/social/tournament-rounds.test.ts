import { describe, expect, it } from 'vitest';
import { calculateRoundRobinStandings, createRoundRobinPlan, parseRoundRobinRoster } from './tournament-rounds';

describe('offline round-robin pairing planner', () => {
  it('rejects oversize, ambiguous, empty and duplicated rosters', () => {
    for (const roster of ['A\nB\nC', 'A\nB\nC\nD\na', 'A\nB\nC\n' + 'D'.repeat(33),
      'A\nB\nC\nD\n'.repeat(4), 'x'.repeat(1025)]) {
      expect(() => parseRoundRobinRoster(roster)).toThrow();
    }
    expect(() => createRoundRobinPlan(['A', 'B', '', 'D'])).toThrow();
    expect(parseRoundRobinRoster('  An  \n Binh\n Chi\n Dung  ')).toEqual(['An', 'Binh', 'Chi', 'Dung']);
    expect(parseRoundRobinRoster('José\nB\nC\nD')).toEqual(['José', 'B', 'C', 'D']);
    expect(() => parseRoundRobinRoster('José\nJose\u0301\nC\nD')).toThrow();
  });

  it('creates complete unique fixtures with balanced colors and correctly rotated byes', () => {
    for (let count = 4; count <= 16; count += 1) {
      const players = Array.from({ length: count }, (_, id) => `Player ${id + 1}`);
      const plan = createRoundRobinPlan(players);
      const pairs = new Set<string>();
      const colorBalance = Array.from({ length: count }, () => 0);
      const byes = Array.from({ length: count }, () => 0);
      expect(plan.rounds).toHaveLength(count % 2 === 0 ? count - 1 : count);
      for (const round of plan.rounds) {
        const participants = new Set<number>();
        for (const match of round.matches) {
          expect(match.whiteId).not.toBe(match.blackId);
          expect(participants.has(match.whiteId)).toBe(false);
          expect(participants.has(match.blackId)).toBe(false);
          participants.add(match.whiteId);
          participants.add(match.blackId);
          const pair = [match.whiteId, match.blackId].sort((a, b) => a - b).join(':');
          expect(pairs.has(pair)).toBe(false);
          pairs.add(pair);
          colorBalance[match.whiteId] += 1;
          colorBalance[match.blackId] -= 1;
        }
        if (round.byeId !== null) {
          expect(participants.has(round.byeId)).toBe(false);
          byes[round.byeId] += 1;
          participants.add(round.byeId);
        }
        expect(participants.size).toBe(count);
      }
      expect(pairs.size).toBe(count * (count - 1) / 2);
      expect(Math.max(...colorBalance.map(Math.abs))).toBeLessThanOrEqual(count % 2 === 0 ? 1 : 2);
      expect(byes).toEqual(Array.from({ length: count }, () => count % 2));
      expect(createRoundRobinPlan(players)).toEqual(plan);
    }
  });

  it('totals only entered results and awards neither byes nor unknown matches', () => {
    const plan = createRoundRobinPlan(['A', 'B', 'C', 'D', 'E']);
    const [a, b] = plan.rounds[0].matches;
    const standings = calculateRoundRobinStandings(plan, {
      [a.id]: 'white', [b.id]: 'draw', 'unrelated': 'white',
    });
    const whiteWinner = standings.find((player) => player.id === a.whiteId)!;
    const blackLoser = standings.find((player) => player.id === a.blackId)!;
    expect(whiteWinner).toMatchObject({ played: 1, wins: 1, points: 1 });
    expect(blackLoser).toMatchObject({ played: 1, losses: 1, points: 0 });
    expect(standings.find((player) => player.id === b.whiteId)).toMatchObject({ played: 1, draws: 1, points: 0.5 });
    expect(standings.find((player) => player.id === plan.rounds[0].byeId)).toMatchObject({ played: 0, points: 0 });
    expect(standings.map((player) => player.points)).toEqual([1, 0.5, 0.5, 0, 0]);
    expect(calculateRoundRobinStandings(plan, {})[0].id).toBe(0);
  });
});
