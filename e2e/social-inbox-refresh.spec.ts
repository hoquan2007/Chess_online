import { expect, test } from '@playwright/test';

test('social inbox rejects stale refreshes and checks for new activity on focus', async ({ page }) => {
  // This is browser UI coverage with a fake session; it does not prove hosted Supabase RLS.
  await page.goto('/register');
  if (await page.getByText('Online accounts are unavailable until Supabase environment variables are configured.').isVisible()) {
    test.skip(true, 'Public Supabase credentials are not configured in this build.');
  }

  const accountId = '11111111-1111-4111-8111-111111111111';
  const senderId = '22222222-2222-4222-8222-222222222222';
  const payload = Buffer.from(JSON.stringify({
    aud: 'authenticated', sub: accountId, exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.mock-signature`;
  const user = {
    id: accountId, email: 'rookline-inbox@example.test', aud: 'authenticated',
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
  };
  await page.route((url) => url.pathname.endsWith('/auth/v1/user'), (route) => route.fulfill({
    status: route.request().headers().authorization === `Bearer ${token}` ? 200 : 401,
    contentType: 'application/json', body: JSON.stringify(user),
  }));

  let releaseOld: () => void = () => {};
  const oldResponseGate = new Promise<void>((resolve) => { releaseOld = resolve; });
  let reads = 0;
  let oldResponseSent = false;
  let markReadCalls = 0;
  let markedRead = false;
  const inbox = (notifications: number) => ({
    accountId, profiles: [{ id: senderId, username: 'opponent', display_name: 'Opponent' }],
    connections: [], blocks: [],
    notifications: Array.from({ length: notifications }, (_, index) => ({
      id: index + 1, actor_id: senderId, kind: 'friend_request', created_at: new Date().toISOString(),
      read_at: markedRead ? new Date().toISOString() : null,
    })),
  });
  await page.route('**/api/social', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON().action).toBe('mark_read');
      markReadCalls++;
      markedRead = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'read' }) });
    }
    expect(route.request().method()).toBe('GET');
    reads++;
    if (reads === 1) {
      await oldResponseGate;
      oldResponseSent = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inbox(0)) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inbox(reads === 2 ? 1 : 2)) });
    }
  });

  try {
    await page.goto(`/auth/callback?next=%2Fplay%2Flocal#access_token=${encodeURIComponent(token)}&refresh_token=mock-refresh-token&token_type=bearer&type=signup&expires_in=3600`);
    await expect(page).toHaveURL(/\/play\/local$/);
    // Retain the mocked client-only session: a server reload cannot validate a fake JWT.
    await page.getByRole('link', { name: 'Friends' }).first().click();
    await expect(page).toHaveURL(/\/friends$/);
    const refresh = page.getByRole('button', { name: 'Refresh inbox' });
    await expect(refresh).toBeVisible();
    await expect.poll(() => reads).toBe(1);

    await refresh.click();
    await expect.poll(() => reads).toBe(2);
    await expect(page.getByRole('heading', { name: 'Notifications (1 unread)' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Inbox refreshed' })).toBeVisible();

    releaseOld();
    await expect.poll(() => oldResponseSent).toBe(true);
    await expect(page.getByRole('heading', { name: 'Notifications (1 unread)' })).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => reads).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole('heading', { name: 'Notifications (2 unread)' })).toBeVisible();

    await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect.poll(() => markReadCalls).toBe(1);
    await expect(page.getByRole('heading', { name: 'Notifications (0 unread)' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Notifications marked as read' })).toBeVisible();
  } finally {
    releaseOld();
  }
});
