import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";

// Opt-in only: this test creates real Auth identities and games on the dedicated
// Rookline staging project. It never runs as part of the default browser suite.
loadEnvConfig(process.cwd(), true);
const enabled = process.env.ROOKLINE_STAGING_E2E === "1";
const projectRef = "tyvczicinpjixmxgjhjn";
const appOrigin = "http://127.0.0.1:3100";

test("two real Supabase users play an authoritative private game", async ({ browser }) => {
  test.skip(!enabled, "Opt in with ROOKLINE_STAGING_E2E=1 and dedicated staging credentials.");
  test.setTimeout(180_000);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || new URL(url).hostname !== `${projectRef}.supabase.co` || !publishable || !secret) {
    throw new Error(`Staging test requires public and server-only credentials for project ${projectRef}.`);
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const createdUsers: string[] = [];
  const createdGames: string[] = [];
  const contexts: BrowserContext[] = [];
  const nonce = randomBytes(9).toString("hex");
  const password = randomBytes(25).toString("base64url") + "A1!";
  const emails = ["white", "black", "outsider"].map((role) => `rookline-${nonce}-${role}@example.com`);

  async function createDisposableUser(email: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: "Rookline staging test" },
    });
    if (error || !data.user) throw new Error(`Staging test user creation failed: ${error?.message ?? "missing user"}`);
    createdUsers.push(data.user.id);
    return data.user.id;
  }

  async function signIn(context: BrowserContext, email: string) {
    const page = await context.newPage();
    await page.goto("/login?next=%2Fplay%2Fonline");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/play\/online$/);
    await expect(page.getByRole("button", { name: "Create challenge" })).toBeVisible();
    return page;
  }

  async function gameState(context: BrowserContext, id: string) {
    const response = await context.request.get(`/api/games/${id}`);
    expect(response.status()).toBe(200);
    return (await response.json()).game as { id: string; ply: number; status: string; winner_id: string | null; result: string | null; pgn: string };
  }

  async function move(context: BrowserContext, gameId: string, from: string, to: string, expectedPly: number, requestId = randomUUID()) {
    return context.request.post(`/api/games/${gameId}/move`, {
      data: { from, to, expectedPly, requestId },
    });
  }

  try {
    // Create in order so cleanup and the outsider identity stay deterministic.
    const whiteId = await createDisposableUser(emails[0]);
    const blackId = await createDisposableUser(emails[1]);
    const outsiderId = await createDisposableUser(emails[2]);
    const [whiteContext, blackContext, outsiderContext] = await Promise.all([
      browser.newContext({ baseURL: appOrigin }),
      browser.newContext({ baseURL: appOrigin }),
      browser.newContext({ baseURL: appOrigin }),
    ]);
    contexts.push(whiteContext, blackContext, outsiderContext);
    const whitePage = await signIn(whiteContext, emails[0]);
    const blackPage = await signIn(blackContext, emails[1]);
    await signIn(outsiderContext, emails[2]);

    const outsider = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: outsiderLoginError } = await outsider.auth.signInWithPassword({ email: emails[2], password });
    expect(outsiderLoginError).toBeNull();

    const created = await whiteContext.request.post("/api/games", { data: { control: "5+0" } });
    expect(created.status()).toBe(201);
    const gameId = (await created.json()).id as string;
    expect(gameId).toMatch(/^[a-f0-9-]{36}$/);
    createdGames.push(gameId);

    const unjoined = await blackContext.request.get(`/api/games/${gameId}`);
    expect(unjoined.status()).toBe(403);
    expect((await unjoined.json()).joinable).toBe(true);
    const joined = await blackContext.request.post(`/api/games/${gameId}/join`);
    expect(joined.status()).toBe(200);
    expect((await gameState(whiteContext, gameId)).status).toBe("active");
    expect((await gameState(blackContext, gameId)).status).toBe("active");
    expect((await outsiderContext.request.get(`/api/games/${gameId}`)).status()).toBe(403);
    expect((await move(outsiderContext, gameId, "e2", "e4", 0)).status()).toBe(403);

    // Verify actual RLS with a third authenticated identity, and GRANT denial
    // against direct authoritative-table writes that bypass Next.js entirely.
    const { data: visible, error: readError } = await outsider.from("games").select("id").eq("id", gameId);
    expect(readError).toBeNull();
    expect(visible).toEqual([]);
    const { error: writeError } = await outsider.from("games").insert({
      white_id: outsiderId, base_ms: 300000, increment_ms: 0,
      white_ms: 300000, black_ms: 300000,
    });
    expect(writeError).not.toBeNull();

    expect((await move(whiteContext, gameId, "e2", "e5", 0)).status()).toBe(422);
    const openingRequest = randomUUID();
    const first = await move(whiteContext, gameId, "f2", "f3", 0, openingRequest);
    expect(first.status()).toBe(200);
    expect((await first.json()).status).toBe("accepted");
    const duplicate = await move(whiteContext, gameId, "f2", "f3", 0, openingRequest);
    expect(duplicate.status()).toBe(200);
    expect((await duplicate.json()).status).toBe("duplicate");
    expect((await move(whiteContext, gameId, "e2", "e4", 0, openingRequest)).status()).toBe(409);
    expect((await move(whiteContext, gameId, "g2", "g4", 1)).status()).toBe(409);
    expect((await move(blackContext, gameId, "e7", "e6", 1)).status()).toBe(200);
    expect((await move(whiteContext, gameId, "g2", "g4", 2)).status()).toBe(200);
    // Black's queen checkmates after 1.f3 e6 2.g4 Qh4#.
    expect((await move(blackContext, gameId, "d8", "h4", 3)).status()).toBe(200);
    const finalWhite = await gameState(whiteContext, gameId);
    const finalBlack = await gameState(blackContext, gameId);
    expect(finalWhite).toMatchObject({ ply: 4, status: "completed", winner_id: blackId });
    expect(finalBlack.pgn).toBe(finalWhite.pgn);
    expect(finalWhite.pgn).toContain("Qh4#");
    expect((await move(whiteContext, gameId, "e2", "e4", 4)).status()).toBe(409);

    // Both real browser contexts must read the persisted result after a reload.
    await Promise.all([whitePage.goto(`/game/${gameId}`), blackPage.goto(`/game/${gameId}`)]);
    await expect(whitePage.getByText("Game finished", { exact: false }).first()).toBeVisible();
    await expect(blackPage.getByText("Game finished", { exact: false }).first()).toBeVisible();

    // Simultaneous legal requests must result in a single accepted ply.
    const raceCreate = await whiteContext.request.post("/api/games", { data: { control: "5+0" } });
    expect(raceCreate.status()).toBe(201);
    const raceId = (await raceCreate.json()).id as string;
    createdGames.push(raceId);
    expect((await blackContext.request.post(`/api/games/${raceId}/join`)).status()).toBe(200);
    await Promise.all([whitePage.goto(`/game/${raceId}`), blackPage.goto(`/game/${raceId}`)]);
    await expect(blackPage.getByText("Your game room")).toBeVisible();
    const [raceA, raceB] = await Promise.all([
      move(whiteContext, raceId, "e2", "e4", 0),
      move(whiteContext, raceId, "d2", "d4", 0),
    ]);
    expect([raceA.status(), raceB.status()].sort()).toEqual([200, 409]);
    expect((await gameState(whiteContext, raceId)).ply).toBe(1);

    // The opponent must converge through live hints or polling without a reload.
    await expect.poll(async () => (
      await blackPage.locator('[aria-label="Move history"] strong').first().textContent()
    )?.trim(), { timeout: 15_000 }).toMatch(/^(e4|d4)$/);

    // Verify authoritative resignation remains visible after a disconnected
    // opponent comes back online, even when Realtime messages were missed.
    await blackContext.setOffline(true);
    try {
      const resigned = await whiteContext.request.post(`/api/games/${raceId}/resign`);
      expect(resigned.status()).toBe(200);
    } finally {
      await blackContext.setOffline(false);
    }
    await blackPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(blackPage.getByText("Game finished", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    expect(await gameState(blackContext, raceId)).toMatchObject({
      ply: 1, status: "completed", result: "resignation", winner_id: blackId,
    });

    await whitePage.goto("/play/online");
    await whitePage.getByRole("button", { name: "Sign out" }).first().click();
    await expect.poll(async () => (await whiteContext.request.get("/api/games")).status()).toBe(401);
    expect(whiteId).not.toBe(blackId);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    // Delete dependent game rows before users (games references auth.users).
    const errors: string[] = [];
    for (const gameId of createdGames) {
      const { error } = await admin.from("games").delete().eq("id", gameId);
      if (error) errors.push(`game cleanup ${gameId}: ${error.message}`);
    }
    for (const userId of createdUsers) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) errors.push(`user cleanup ${userId}: ${error.message}`);
    }
    if (errors.length) throw new Error(`Staging cleanup failed: ${errors.join("; ")}`);
  }
});
