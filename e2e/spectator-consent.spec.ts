import { Chess } from 'chess.js';
import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const white = '22222222-2222-4222-8222-222222222222';
const black = '33333333-3333-4333-8333-333333333333';
const url = `/api/games/${id}/spectators`;

test('read-only board disappears immediately when either player revokes consent', async ({ page }) => {
  const chess = new Chess();
  chess.move('e4');
  const game = {
    id, status: 'active', fen: chess.fen(), pgn: chess.pgn(), turn: chess.turn(), ply: 1,
    base_ms: 300000, increment_ms: 0, white_ms: 298000, black_ms: 300000,
    clock_anchor_at: new Date().toISOString(), result: null,
  };
  let allowed = true;
  await page.route(`**${url}`, (route) => route.fulfill({
    status: allowed ? 200 : 404,
    contentType: 'application/json',
    body: JSON.stringify(allowed ? { role: 'spectator', game, serverNow: Date.now() } : { error: 'Game is not available to watch' }),
  }));

  await page.goto(`/watch/${id}`);
  await expect(page.getByRole('heading', { name: 'Live game' })).toBeVisible();
  await expect(page.getByLabel('Read-only spectator chessboard')).toBeVisible();
  await expect(page.getByLabel('Spectator move history').getByText('e4', { exact: false })).toBeVisible();
  await expect(page.getByText('Watching only')).toBeVisible();
  expect(await page.getByRole('button', { name: /resign|offer draw|claim draw|make move/i }).count()).toBe(0);

  allowed = false;
  await page.getByRole('button', { name: 'Sync' }).click();
  await expect(page.getByLabel('Read-only spectator chessboard')).toHaveCount(0);
  await expect(page.getByText(/spectator permission was revoked/)).toBeVisible();
  await expect(page.getByText('e4', { exact: true })).toHaveCount(0);
});

test('spectator replay keeps its selected move through live updates and clears on revocation', async ({ page }) => {
  const chess = new Chess();
  for (const move of ['e4', 'e5', 'Nf3']) chess.move(move);
  let allowed = true;
  await page.route(`**${url}`, (route) => route.fulfill({
    status: allowed ? 200 : 404,
    contentType: 'application/json',
    body: JSON.stringify(allowed ? {
      role: 'spectator', serverNow: Date.now(),
      game: {
        id, status: 'active', fen: chess.fen(), pgn: chess.pgn(), turn: chess.turn(), ply: chess.history().length,
        base_ms: 300000, increment_ms: 0, white_ms: 297000, black_ms: 298000,
        clock_anchor_at: new Date().toISOString(), result: null,
      },
    } : { error: 'Game is private' }),
  }));

  await page.goto(`/watch/${id}`);
  const position = page.getByLabel('Spectator replay position');
  const controls = page.getByLabel('Spectator replay controls');
  await expect(position).toContainText('Live position · 3 moves');
  await page.getByRole('button', { name: 'Move 1: e4' }).click();
  await expect(position).toContainText('Reviewing move 1 of 3');
  await expect(page.getByRole('button', { name: 'Move 1: e4' })).toHaveAttribute('aria-pressed', 'true');

  chess.move('Nc6');
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await expect(position).toContainText('Reviewing move 1 of 4');
  await controls.getByRole('button', { name: 'Previous move' }).click();
  await expect(position).toContainText('Reviewing move 0 of 4');
  await controls.getByRole('button', { name: 'Next move' }).click();
  await expect(position).toContainText('Reviewing move 1 of 4');
  await controls.getByRole('button', { name: 'Return to live' }).click();
  await expect(position).toContainText('Live position · 4 moves');

  await controls.getByRole('button', { name: 'First move' }).click();
  await expect(position).toContainText('Reviewing move 0 of 4');
  allowed = false;
  await page.getByRole('button', { name: 'Sync', exact: true }).click();
  await expect(page.getByLabel('Read-only spectator chessboard')).toHaveCount(0);
  await expect(position).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move 1: e4' })).toHaveCount(0);
});

test('players must opt in before a shareable watch link appears and may revoke it', async ({ page }) => {
  let enabled = false;
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      viewerColor: 'w', serverNow: Date.now(), game: {
        id, white_id: white, black_id: black, status: 'active', fen: new Chess().fen(), pgn: '',
        turn: 'w', ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000,
        black_ms: 300000, clock_anchor_at: new Date().toISOString(),
        result: null, winner_id: null, rated: false, created_at: '2026-11-05T00:00:00Z',
      },
    }),
  }));
  await page.route(`**${url}`, (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['x-rookline-account']).toBe(white);
      enabled = route.request().postDataJSON().enabled;
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ role: 'player', enabled, otherEnabled: true, open: enabled }),
    });
  });

  await page.goto(`/game/${id}`);
  const panel = page.getByLabel('Spectator permissions');
  await expect(panel.getByRole('heading', { name: 'Spectators', exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Open watch link' })).toHaveCount(0);
  // The checkbox is server-confirmed: clicking starts an RPC and it becomes
  // checked only after the consent response is accepted.
  await panel.getByRole('checkbox', { name: 'Allow spectators' }).click();
  await expect(panel.getByRole('checkbox', { name: 'Allow spectators' })).toBeChecked();
  await expect(panel.getByRole('link', { name: 'Open watch link' })).toHaveAttribute('href', `/watch/${id}`);
  await panel.getByRole('checkbox', { name: 'Allow spectators' }).click();
  await expect(panel.getByRole('checkbox', { name: 'Allow spectators' })).not.toBeChecked();
  await expect(panel.getByRole('link', { name: 'Open watch link' })).toHaveCount(0);
});
