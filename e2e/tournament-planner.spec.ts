import { expect, test } from '@playwright/test';

async function downloadText(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  let result = '';
  for await (const chunk of stream) result += Buffer.from(chunk).toString('utf8');
  return result;
}

test('offline tournament planner creates complete rounds, updates scores and validates duplicate names', async ({ page }) => {
  await page.goto('/tournaments');
  await page.getByRole('link', { name: /Open the offline pairing planner/ }).click();
  await expect(page).toHaveURL(/\/tournaments\/planner$/);

  await page.getByLabel('Players (4–16, one name per line)').fill('An\nBinh\nChi\nDung\nEm');
  await page.getByRole('button', { name: 'Generate rounds' }).click();
  await expect(page.getByRole('region', { name: 'Practice standings' })).toContainText('0 of 10 games entered · 5 rounds');
  await expect(page.getByRole('region', { name: 'Round robin schedule' }).getByRole('heading', { name: /Round \d/ })).toHaveCount(5);
  await expect(page.getByText('Bye:', { exact: false })).toHaveCount(5);

  const first = page.getByLabel(/^Round 1: .* result$/).first();
  await first.selectOption('white');
  await expect(page.getByRole('region', { name: 'Practice standings' })).toContainText('1 of 10 games entered');
  await expect(page.getByRole('region', { name: 'Practice standings' }).getByRole('row').filter({ hasText: /1\.0/ })).toHaveCount(1);

  await page.getByRole('button', { name: 'Clear results' }).click();
  await expect(first).toHaveValue('');
  await expect(page.getByRole('region', { name: 'Practice standings' })).toContainText('0 of 10 games entered');

  await page.getByLabel('Players (4–16, one name per line)').fill('An\nBinh\nChi\nan');
  await page.getByRole('button', { name: 'Generate rounds' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Every player must have a different name.' }))
    .toHaveText('Every player must have a different name.');
});

test('offline tournament draft export, restore, CSV download and malicious import rejection', async ({ page }) => {
  await page.goto('/tournaments/planner');
  await page.getByLabel('Players (4–16, one name per line)').fill('An\nBinh\nChi\nDung\nEm');
  await page.getByRole('button', { name: 'Generate rounds' }).click();
  const first = page.getByLabel(/^Round 1: .* result$/).first();
  await first.selectOption('draw');

  const draftPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download practice draft' }).click();
  const draft = await draftPromise;
  expect(draft.suggestedFilename()).toBe('rookline-tournament-draft.json');
  const content = await downloadText(draft);
  // In odd-sized rounds, the first pairing may be r1-m2 because table one is a bye.
  expect(Object.values(JSON.parse(content).results)).toEqual(['draw']);

  await page.getByRole('button', { name: 'Clear results' }).click();
  await expect(first).toHaveValue('');
  await page.getByLabel('Import practice draft JSON').setInputFiles({
    name: 'draft.json', mimeType: 'application/json', buffer: Buffer.from(content),
  });
  await expect(first).toHaveValue('draw');
  await expect(page.getByText('Practice schedule and recorded results restored from your file.')).toBeVisible();

  const csvPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download schedule CSV' }).click();
  const csv = await csvPromise;
  expect(csv.suggestedFilename()).toBe('rookline-schedule.csv');
  expect(await downloadText(csv)).toContain('"1/2-1/2"');

  const invalid = JSON.parse(content);
  invalid.results['r99-m1'] = 'white';
  await page.getByLabel('Import practice draft JSON').setInputFiles({
    name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'unknown match' })).toBeVisible();
  await expect(first).toHaveValue('draw'); // Failed imports keep existing work.
});
