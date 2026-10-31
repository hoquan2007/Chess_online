import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { resolveStagingAppOrigin } from "./staging-target";

// Opt-in only: this test creates real Auth identities and games on the dedicated
// Rookline staging project. It never runs as part of the default browser suite.
loadEnvConfig(process.cwd(), true);
const enabled = process.env.ROOKLINE_STAGING_E2E === "1";
const projectRef = "tyvczicinpjixmxgjhjn";
const appOrigin = enabled ? resolveStagingAppOrigin(process.env.ROOKLINE_STAGING_APP_ORIGIN) : "http://127.0.0.1:3100";

test("two real Supabase users play an authoritative private game", async ({ browser }) => {
  test.skip(!enabled, "Opt in with ROOKLINE_STAGING_E2E=1 and dedicated staging credentials.");
  test.setTimeout(220_000);

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
  const realtimeClients: Array<{ removeAllChannels: () => Promise<unknown> }> = [];
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

  // Playwright's APIRequestContext is not a browser fetch; attach the same
  // Origin a real authenticated browser POST would send.
  function postGame(context: BrowserContext, path: string, data?: Record<string, unknown>) {
    return context.request.post(path, { headers: { Origin: appOrigin }, data });
  }

  async function move(context: BrowserContext, gameId: string, from: string, to: string, expectedPly: number, requestId = randomUUID()) {
    return postGame(context, `/api/games/${gameId}/move`, { from, to, expectedPly, requestId });
  }

  // This deliberately observes real Postgres change delivery, independently
  // from GameRoom's three-second polling fallback. An unrelated account must
  // never receive a private game's change event through the public key.
  async function observeGameChanges(email: string, role: string, gameId: string, onChange: (ply: number | null) => void) {
    const client = createClient(url!, publishable!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    realtimeClients.push(client);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Realtime ${role} authentication failed: ${error.message}`);
    const channel = client.channel(`rookline-staging-${nonce}-${role}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}`,
    }, (payload) => {
      // Record even incomplete payloads: any callback delivered to the third
      // identity is a privacy failure, regardless of visible columns.
      onChange(typeof payload.new.ply === "number" ? payload.new.ply : null);
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Realtime ${role} subscription timed out`)), 15_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          reject(new Error(`Realtime ${role} subscription: ${status}`));
        }
      });
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

    // The actual browser sets Host, Origin and Fetch Metadata through the
    // public TLS proxy; explicit APIRequestContext headers cannot prove this.
    const browserCreate = await whitePage.evaluate(async () => {
      const response = await fetch("/api/games", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control: "5+0" }),
      });
      return { status: response.status, body: await response.json() };
    });
    expect(browserCreate.status).toBe(201);
    const browserId = browserCreate.body.id as string;
    expect(browserId).toMatch(/^[a-f0-9-]{36}$/);
    createdGames.push(browserId);
    expect((await postGame(whiteContext, `/api/games/${browserId}/cancel`)).status()).toBe(200);

    // Through the same public entry point, a forged or downgraded Origin must
    // fail before authentication or database mutation occurs.
    for (const hostileOrigin of ["https://untrusted.example", appOrigin.replace(/^https:/, "http:")]) {
      if (hostileOrigin === appOrigin) continue;
      const denied = await whiteContext.request.post("/api/games", {
        headers: { Origin: hostileOrigin }, data: { control: "5+0" },
      });
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toMatchObject({ error: "Cross-origin action denied" });
    }

    const outsider = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: outsiderLoginError } = await outsider.auth.signInWithPassword({ email: emails[2], password });
    expect(outsiderLoginError).toBeNull();

    // Genuine cookie-backed profile edit and RLS: the owner can rename their
    // profile, but another authenticated account cannot change that row.
    const { data: originalProfile, error: profileReadError } = await admin.from("profiles")
      .select("username").eq("id", whiteId).single();
    expect(profileReadError).toBeNull();
    expect(originalProfile?.username).toBeTruthy();
    const editedUsername = `rook_${nonce}`;
    await whitePage.goto(`/profile/${originalProfile!.username}`);
    await expect(whitePage.getByRole("heading", { name: "Edit your profile" })).toBeVisible();
    await whitePage.getByRole("textbox", { name: "Username" }).fill(editedUsername);
    await whitePage.getByRole("textbox", { name: "Display name" }).fill("Verified profile");
    await whitePage.getByRole("button", { name: "Save profile" }).click();
    await expect(whitePage).toHaveURL(new RegExp(`/profile/${editedUsername}$`));
    await expect(whitePage.getByRole("heading", { name: "Verified profile" })).toBeVisible();
    await blackPage.goto(`/profile/${editedUsername}`);
    await expect(blackPage.getByRole("heading", { name: "Verified profile" })).toBeVisible();
    await expect(blackPage.getByRole("button", { name: "Save profile" })).toHaveCount(0);
    const { error: unauthorizedEditError } = await outsider.from("profiles")
      .update({ display_name: "Impersonated" }).eq("id", whiteId);
    // RLS may silently filter the row or return a policy error; either must
    // leave the canonical profile untouched.
    const { data: canonicalProfile, error: canonicalError } = await admin.from("profiles")
      .select("username,display_name").eq("id", whiteId).single();
    expect(canonicalError).toBeNull();
    expect(canonicalProfile).toMatchObject({ username: editedUsername, display_name: "Verified profile" });
    if (unauthorizedEditError) expect(unauthorizedEditError.code).toBeTruthy();

    // Real identity-scoped account settings persist across reload and UI entry points.
    await whitePage.goto("/settings");
    await expect(whitePage.getByRole("status").filter({ hasText: "Preferences synced" })).toBeVisible();
    await whitePage.getByRole("button", { name: "Light theme", exact: true }).click();
    await whitePage.getByRole("button", { name: "Off", exact: true }).click();
    await expect.poll(async () => {
      const response = await whiteContext.request.get("/api/preferences");
      expect(response.status()).toBe(200);
      return (await response.json()).preferences;
    }).toEqual({ theme: "light", sounds_enabled: false });
    await whitePage.reload();
    await expect(whitePage.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    await expect(whitePage.getByRole("button", { name: "Off", exact: true })).toHaveAttribute("aria-pressed", "true");
    const { data: outsiderPreferences, error: outsiderPrefError } = await outsider.from("preferences")
      .select("user_id").eq("user_id", whiteId);
    expect(outsiderPrefError).toBeNull();
    expect(outsiderPreferences).toEqual([]);
    const { error: outsiderPrefWriteError } = await outsider.from("preferences")
      .update({ theme: "dark" }).eq("user_id", whiteId);
    if (outsiderPrefWriteError) expect(outsiderPrefWriteError.code).toBeTruthy();
    const { data: whitePreferences } = await admin.from("preferences").select("theme,sounds_enabled")
      .eq("user_id", whiteId).single();
    expect(whitePreferences).toEqual({ theme: "light", sounds_enabled: false });
    await blackPage.goto("/settings");
    await expect(blackPage.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "false");
    await whitePage.getByRole("button", { name: "Use dark theme" }).click();
    await expect.poll(async () => (await (await whiteContext.request.get("/api/preferences")).json()).preferences.theme)
      .toBe("dark");
    // Restore the theme before continuing the multi-client game acceptance.
    await whitePage.getByRole("button", { name: "Light theme", exact: true }).click();
    await expect.poll(async () => (await (await whiteContext.request.get("/api/preferences")).json()).preferences.theme)
      .toBe("light");

    // Only the creator may cancel a waiting challenge, including after a
    // reload. Direct authenticated RPC execution must remain prohibited.
    const pendingCreate = await postGame(whiteContext, "/api/games", { control: "5+0" });
    expect(pendingCreate.status()).toBe(201);
    const pendingId = (await pendingCreate.json()).id as string;
    createdGames.push(pendingId);
    expect((await postGame(outsiderContext, `/api/games/${pendingId}/cancel`)).status()).toBe(409);
    expect((await postGame(blackContext, `/api/games/${pendingId}/cancel`)).status()).toBe(409);
    const { error: directCancelError } = await outsider.rpc("rookline_cancel_challenge", {
      p_game: pendingId, p_player: whiteId,
    });
    expect(directCancelError).not.toBeNull();
    await whitePage.goto(`/game/${pendingId}`);
    await whitePage.getByRole("button", { name: "Cancel challenge" }).click();
    await expect(whitePage.getByText("Challenge cancelled", { exact: true })).toBeVisible();
    expect((await postGame(whiteContext, `/api/games/${pendingId}/cancel`)).status()).toBe(200);
    expect((await postGame(blackContext, `/api/games/${pendingId}/join`)).status()).toBe(409);
    expect((await gameState(whiteContext, pendingId)).status).toBe("cancelled");
    const cancelledRead = await blackContext.request.get(`/api/games/${pendingId}`);
    expect(cancelledRead.status()).toBe(403);
    expect((await cancelledRead.json()).joinable).toBe(false);

    // A concurrent join and cancellation must produce exactly one winner.
    const competingCreate = await postGame(whiteContext, "/api/games", { control: "5+0" });
    expect(competingCreate.status()).toBe(201);
    const competingId = (await competingCreate.json()).id as string;
    createdGames.push(competingId);
    const [cancelRace, joinRace] = await Promise.all([
      postGame(whiteContext, `/api/games/${competingId}/cancel`),
      postGame(blackContext, `/api/games/${competingId}/join`),
    ]);
    expect([cancelRace.status(), joinRace.status()].sort()).toEqual([200, 409]);
    const competingState = await gameState(whiteContext, competingId);
    expect(competingState.status).toBe(cancelRace.status() === 200 ? "cancelled" : "active");
    if (competingState.status === "active") {
      expect((await postGame(whiteContext, `/api/games/${competingId}/cancel`)).status()).toBe(409);
    }

    const created = await postGame(whiteContext, "/api/games", { control: "5+0" });
    expect(created.status()).toBe(201);
    const gameId = (await created.json()).id as string;
    expect(gameId).toMatch(/^[a-f0-9-]{36}$/);
    createdGames.push(gameId);

    const unjoined = await blackContext.request.get(`/api/games/${gameId}`);
    expect(unjoined.status()).toBe(403);
    expect((await unjoined.json()).joinable).toBe(true);
    const joined = await postGame(blackContext, `/api/games/${gameId}/join`);
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

    // Real authenticated archive reads must expose only the players' games.
    const [whiteArchive, blackArchive, outsiderArchive] = await Promise.all([
      whiteContext.request.get("/api/games"),
      blackContext.request.get("/api/games"),
      outsiderContext.request.get("/api/games"),
    ]);
    expect([whiteArchive.status(), blackArchive.status(), outsiderArchive.status()]).toEqual([200, 200, 200]);
    const archiveFor = async (response: typeof whiteArchive) => (await response.json()).games as { id: string }[];
    expect((await archiveFor(whiteArchive)).map((entry) => entry.id)).toContain(gameId);
    expect((await archiveFor(blackArchive)).map((entry) => entry.id)).toContain(gameId);
    expect((await archiveFor(outsiderArchive)).map((entry) => entry.id)).not.toContain(gameId);
    expect((await outsiderContext.request.get("/api/games?cursor=invalid")).status()).toBe(400);

    // Both real browser contexts must read the persisted result after a reload.
    await Promise.all([whitePage.goto(`/game/${gameId}`), blackPage.goto(`/game/${gameId}`)]);
    await expect(whitePage.getByText("Game finished", { exact: false }).first()).toBeVisible();
    await expect(blackPage.getByText("Game finished", { exact: false }).first()).toBeVisible();
    await whitePage.goto("/games");
    await expect(whitePage.getByRole("region", { name: "Online game history" }).locator(`a[href="/game/${gameId}"]`)).toBeVisible();

    // Simultaneous legal requests must result in a single accepted ply.
    const raceCreate = await postGame(whiteContext, "/api/games", { control: "5+0" });
    expect(raceCreate.status()).toBe(201);
    const raceId = (await raceCreate.json()).id as string;
    createdGames.push(raceId);
    expect((await postGame(blackContext, `/api/games/${raceId}/join`)).status()).toBe(200);
    await Promise.all([whitePage.goto(`/game/${raceId}`), blackPage.goto(`/game/${raceId}`)]);
    await expect(blackPage.getByText("Your game room")).toBeVisible();
    const delivered: Record<"white" | "black" | "outsider", Array<number | null>> = {
      white: [], black: [], outsider: [],
    };
    await Promise.all([
      observeGameChanges(emails[0], "white", raceId, (ply) => delivered.white.push(ply)),
      observeGameChanges(emails[1], "black", raceId, (ply) => delivered.black.push(ply)),
      observeGameChanges(emails[2], "outsider", raceId, (ply) => delivered.outsider.push(ply)),
    ]);
    const [raceA, raceB] = await Promise.all([
      move(whiteContext, raceId, "e2", "e4", 0),
      move(whiteContext, raceId, "d2", "d4", 0),
    ]);
    expect([raceA.status(), raceB.status()].sort()).toEqual([200, 409]);
    expect((await gameState(whiteContext, raceId)).ply).toBe(1);

    // A passing poll of the UI alone is insufficient to accept Realtime.
    // Both participants must receive the same committed ply through sockets.
    await expect.poll(() => delivered.white.includes(1) && delivered.black.includes(1), {
      timeout: 15_000,
    }).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(delivered.outsider).toEqual([]);

    // The opponent must converge through live hints or polling without a reload.
    await expect.poll(async () => (
      await blackPage.locator('[aria-label="Move history"] strong').first().textContent()
    )?.trim(), { timeout: 15_000 }).toMatch(/^(e4|d4)$/);

    // Verify authoritative resignation remains visible after a disconnected
    // opponent comes back online, even when Realtime messages were missed.
    await blackContext.setOffline(true);
    try {
      const resigned = await postGame(whiteContext, `/api/games/${raceId}/resign`);
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
    await Promise.allSettled(realtimeClients.map((client) => client.removeAllChannels()));
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
