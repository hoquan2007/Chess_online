import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { resolveStagingAppOrigin } from "./staging-target";

// Explicit opt-in: creates disposable Auth users and hosted S4/S5 records.
// Four S4/S5 SQL migrations including private chat must already be installed on isolated staging.
loadEnvConfig(process.cwd(), true);
const enabled = process.env.ROOKLINE_STAGING_E2E === "1" &&
  process.env.ROOKLINE_STAGING_S4_S5_E2E === "1";
const projectRef = "tyvczicinpjixmxgjhjn";
const origin = enabled ? resolveStagingAppOrigin(process.env.ROOKLINE_STAGING_APP_ORIGIN) : "http://127.0.0.1:3100";
const oidc = process.env.ROOKLINE_STAGING_VERCEL_OIDC_TOKEN;
const headers = (extra: Record<string, string> = {}) =>
  oidc ? { ...extra, "x-vercel-trusted-oidc-idp-token": oidc } : extra;

test("hosted learning progress and community enforce real identities and moderator roles", async ({ browser }) => {
  test.skip(!enabled, "Requires explicitly enabled S4/S5 staging, four installed migrations and Preview credentials.");
  test.setTimeout(180_000);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || new URL(url).hostname !== `${projectRef}.supabase.co` || !publicKey || !secret) {
    throw new Error(`S4/S5 acceptance requires isolated Supabase project ${projectRef} credentials.`);
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const nonce = randomBytes(9).toString("hex");
  const password = randomBytes(24).toString("base64url") + "A1!";
  const emails = ["owner", "friend", "outsider"].map((role) => `rookline-s45-${nonce}-${role}@example.com`);
  const createdUsers: string[] = [];
  const contexts: BrowserContext[] = [];
  const tournaments: string[] = [];
  const reports: number[] = [];
  let moderatorId: string | null = null;

  function get(context: BrowserContext, path: string) {
    return context.request.get(path, { headers: headers() });
  }
  function post(context: BrowserContext, path: string, id: string, data: unknown) {
    return context.request.post(path, {
      headers: headers({ Origin: origin, "X-Rookline-Account": id }), data,
    });
  }
  async function account(email: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: "Rookline S4/S5 staging" },
    });
    if (error || !data.user) throw new Error(`Unable to create disposable user: ${error?.message ?? "missing user"}`);
    createdUsers.push(data.user.id);
    const context = await browser.newContext({ baseURL: origin });
    contexts.push(context);
    if (oidc) {
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin !== origin) return route.continue();
        return route.continue({ headers: headers(route.request().headers()) });
      });
    }
    const page = await context.newPage();
    await page.goto("/login?next=%2Ffriends");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/friends$/);
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("username").eq("id", data.user.id).single();
    if (profileError || !profile?.username) throw new Error("Disposable user profile was not initialized");
    return { id: data.user.id, context, username: profile.username as string };
  }

  try {
    const owner = await account(emails[0]);
    const friend = await account(emails[1]);
    const outsider = await account(emails[2]);

    const saved = await post(owner.context, "/api/learning-progress", owner.id, {
      kind: "study", ids: ["italian:w"],
    });
    expect(saved.status()).toBe(200);
    const ownerProgress = await get(owner.context, "/api/learning-progress?kind=study");
    expect(ownerProgress.status()).toBe(200);
    expect((await ownerProgress.json()).ids).toContain("italian:w");
    const strangerProgress = await get(outsider.context, "/api/learning-progress?kind=study");
    expect(strangerProgress.status()).toBe(200);
    expect((await strangerProgress.json()).ids).not.toContain("italian:w");

    const wrongAccount = await post(owner.context, "/api/learning-progress", friend.id, {
      kind: "study", ids: ["italian:w"],
    });
    expect(wrongAccount.status()).toBe(409);
    const directClient = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: loginError } = await directClient.auth.signInWithPassword({ email: emails[0], password });
    expect(loginError).toBeNull();
    const unauthorized = await directClient.from("learning_progress")
      .insert({ user_id: friend.id, kind: "study", item_id: "italian:w" });
    expect(unauthorized.error).not.toBeNull();

    const invite = await post(owner.context, "/api/social", owner.id, {
      action: "request", username: friend.username,
    });
    expect(invite.status()).toBe(200);
    expect((await invite.json()).status).toBe("requested");
    const friendInbox = await get(friend.context, "/api/social");
    expect(friendInbox.status()).toBe(200);
    expect((await friendInbox.json()).notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor_id: owner.id, kind: "friend_request" }),
    ]));
    const outsiderInbox = await get(outsider.context, "/api/social");
    expect(outsiderInbox.status()).toBe(200);
    expect((await outsiderInbox.json()).notifications).toEqual([]);
    const accepted = await post(friend.context, "/api/social", friend.id, {
      action: "accept", targetId: owner.id,
    });
    expect(accepted.status()).toBe(200);
    expect((await accepted.json()).status).toBe("accepted");
    const forbiddenFriendWrite = await directClient.from("friendships")
      .delete().eq("user_low", owner.id);
    expect(forbiddenFriendWrite.error).not.toBeNull();

    const messageNonce = randomUUID();
    const privateWrite = {
      recipientId: friend.id, body: "Staging private conversation verification", nonce: messageNonce,
    };
    const sent = await post(owner.context, "/api/private-messages", owner.id, privateWrite);
    expect(sent.status()).toBe(200);
    const sentId = (await sent.json()).id;
    const retry = await post(owner.context, "/api/private-messages", owner.id, privateWrite);
    expect(retry.status()).toBe(200);
    expect((await retry.json()).id).toBe(sentId);
    const ownerChat = await get(owner.context, `/api/private-messages?peer=${friend.id}`);
    const friendChat = await get(friend.context, `/api/private-messages?peer=${owner.id}`);
    const outsiderChat = await get(outsider.context, `/api/private-messages?peer=${friend.id}`);
    expect(ownerChat.status()).toBe(200);
    expect(friendChat.status()).toBe(200);
    expect(outsiderChat.status()).toBe(200);
    expect((await ownerChat.json()).messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sentId, sender_id: owner.id, recipient_id: friend.id }),
    ]));
    expect((await friendChat.json()).messages).toHaveLength(1);
    expect((await outsiderChat.json()).messages).toHaveLength(0);
    const directInsert = await directClient.from("private_messages").insert({
      sender_id: owner.id, recipient_id: friend.id, body: "forged direct insert", client_nonce: randomUUID(),
    });
    expect(directInsert.error).not.toBeNull();

    const blocked = await post(owner.context, "/api/social", owner.id, {
      action: "block", targetId: friend.id,
    });
    expect(blocked.status()).toBe(200);
    expect((await blocked.json()).status).toBe("blocked");
    const blockedChat = await get(friend.context, `/api/private-messages?peer=${owner.id}`);
    expect(blockedChat.status()).toBe(200);
    expect((await blockedChat.json()).messages).toHaveLength(0);
    const deniedMessage = await post(friend.context, "/api/private-messages", friend.id, {
      recipientId: owner.id, body: "Should be denied after block", nonce: randomUUID(),
    });
    expect(deniedMessage.status()).toBe(409);
    const blockedRequest = await post(friend.context, "/api/social", friend.id, {
      action: "request", username: owner.username,
    });
    expect(blockedRequest.status()).toBe(409);
    const unblocked = await post(owner.context, "/api/social", owner.id, {
      action: "unblock", targetId: friend.id,
    });
    expect(unblocked.status()).toBe(200);

    const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const created = await post(owner.context, "/api/tournaments", owner.id, {
      action: "create", title: `Staging ${nonce}`, description: "Disposable acceptance event",
      startsAt, capacity: 4,
    });
    expect(created.status()).toBe(200);
    const tournamentId = (await created.json()).tournamentId as string;
    tournaments.push(tournamentId);
    const joined = await post(friend.context, "/api/tournaments", friend.id, {
      action: "join", tournamentId,
    });
    expect(joined.status()).toBe(200);
    expect((await joined.json()).status).toBe("joined");
    const list = await get(friend.context, "/api/tournaments");
    expect(list.status()).toBe(200);
    expect((await list.json()).tournaments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: tournamentId, entries: 1, joined: true }),
    ]));

    const report = await post(owner.context, "/api/reports", owner.id, {
      username: outsider.username, category: "spam", details: "Disposable staging test report for authorization validation.",
    });
    expect(report.status()).toBe(200);
    const reportId = (await report.json()).reportId as number;
    reports.push(reportId);
    const forbiddenQueue = await get(friend.context, "/api/moderation");
    expect(forbiddenQueue.status()).toBe(403);
    const { error: appointError } = await admin.from("moderation_staff").insert({ user_id: friend.id });
    expect(appointError).toBeNull();
    moderatorId = friend.id;
    const queue = await get(friend.context, "/api/moderation");
    expect(queue.status()).toBe(200);
    expect((await queue.json()).reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: reportId, reporter_id: owner.id, target_id: outsider.id }),
    ]));
    const reviewed = await post(friend.context, "/api/moderation", friend.id, {
      reportId, decision: "resolved",
    });
    expect(reviewed.status()).toBe(200);
    const duplicate = await post(friend.context, "/api/moderation", friend.id, {
      reportId, decision: "resolved",
    });
    expect(duplicate.status()).toBe(409);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    const failures: string[] = [];
    if (moderatorId) {
      const { error } = await admin.from("moderation_staff").delete().eq("user_id", moderatorId);
      if (error) failures.push(`moderator cleanup: ${error.message}`);
    }
    for (const id of reports) {
      const { error } = await admin.from("player_reports").delete().eq("id", id);
      if (error) failures.push(`report cleanup ${id}: ${error.message}`);
    }
    for (const id of tournaments) {
      const { error } = await admin.from("tournaments").delete().eq("id", id);
      if (error) failures.push(`tournament cleanup ${id}: ${error.message}`);
    }
    if (failures.length === 0) {
      for (const id of createdUsers) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) failures.push(`user cleanup ${id}: ${error.message}`);
      }
    }
    if (failures.length) throw new Error(`S4/S5 staging cleanup failed: ${failures.join("; ")}`);
  }
});
