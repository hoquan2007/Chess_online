import { expect, test } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { Chess } from "chess.js";

// Use the same public configuration Next loads, including local .env files.
// UI visibility immediately after navigation can race with hydration in CI.
loadEnvConfig(process.cwd());
const browserAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

test("check visibly identifies the attacked king and clears when blocked", async ({ page }) => {
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  for (const move of ["e4", "f5", "Qh5+"]) {
    await input.fill(move);
    await input.press("Enter");
  }
  await expect(page.getByRole("status", { name: "Black king is in check" })).toBeVisible();
  await expect(page.locator('[data-square="e8"] > div').last()).toHaveCSS("background-color", "rgb(217, 74, 67)");
  await input.fill("g6");
  await input.press("Enter");
  await expect(page.getByRole("status", { name: "Black king is in check" })).toHaveCount(0);
});

test("checkmate shows winner dialog and undo/new game reset its state", async ({ page }) => {
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  const moves = ["f3", "e5", "g4", "Qh4#"];
  for (const move of moves) {
    await input.fill(move);
    await input.press("Enter");
  }
  const dialog = page.getByRole("dialog", { name: "Black wins" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Checkmate");
  await expect(page.getByRole("status", { name: "White king is in check" })).toBeVisible();
  await expect(page.locator('[data-square="e1"] > div').last()).toHaveCSS("background-color", "rgb(217, 74, 67)");
  await dialog.getByRole("button", { name: "View board" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status", { name: "White king is in check" })).toHaveCount(0);
  await input.fill("Qh4#");
  await input.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "New game" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Move history")).toContainText("Your moves will appear here");
});

test("online completed authoritative result announces win and preserves checkmate position", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000098";
  const chess = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
  const now = new Date().toISOString();
  const game = { id, white_id: "white-id", black_id: "black-id", status: "completed",
    pgn: chess.pgn(), fen: chess.fen(), turn: "w", ply: 4,
    base_ms: 300000, increment_ms: 0, white_ms: 290000, black_ms: 290000,
    clock_anchor_at: null, result: "Checkmate", winner_id: "black-id", rated: false, created_at: now };
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ game, viewerColor: "b", serverNow: Date.now() }),
  }));
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("dialog", { name: "You won!" })).toBeVisible();
  await expect(page.getByRole("status", { name: "White king is in check" })).toBeVisible();
  await expect(page.locator('[data-square="e1"] > div').last()).toHaveCSS("background-color", "rgb(217, 74, 67)");
  await page.getByRole("dialog").getByRole("button", { name: "View board" }).click();
  await page.getByRole("button", { name: "Sync" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("register requests a callback to the intended page and offers a cooled-down email resend", async ({ page }) => {
  test.skip(!browserAuthConfigured, "Public Supabase browser credentials are not configured in this build.");
  const signupRequests: { url: string; body: Record<string, unknown> }[] = [];
  const resendRequests: { url: string; body: Record<string, unknown> }[] = [];
  await page.route((url) => url.pathname.endsWith("/auth/v1/signup"), (route) => {
    signupRequests.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      user: { id: "11111111-1111-4111-8111-111111111111", email: "rookline-qa@example.test",
        aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      session: null,
    }) });
  });
  await page.route((url) => url.pathname.endsWith("/auth/v1/resend"), (route) => {
    resendRequests.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/register?next=%2Ffriends");
  await page.getByRole("textbox", { name: "Display name" }).fill("QA Player");
  await page.getByRole("textbox", { name: "Email" }).fill("rookline-qa@example.test");
  await page.getByLabel("Password", { exact: true }).fill("one-long-test-password");
  await page.getByLabel("Confirm password").fill("one-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
  expect(signupRequests).toHaveLength(1);
  expect(signupRequests[0].body.email).toBe("rookline-qa@example.test");
  expect(new URL(signupRequests[0].url).searchParams.get("redirect_to")).toBe(
    `${new URL(page.url()).origin}/auth/callback?next=%2Ffriends`,
  );
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status").filter({ hasText: "new verification email" })).toBeVisible();
  expect(resendRequests).toHaveLength(1);
  expect(resendRequests[0].body.email).toBe("rookline-qa@example.test");
  await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
});

test("login explains Supabase's email-not-confirmed failure", async ({ page }) => {
  test.skip(!browserAuthConfigured, "Public Supabase browser credentials are not configured in this build.");
  let tokenRequests = 0;
  await page.route("**/auth/v1/token?grant_type=password", (route) => {
    tokenRequests++;
    return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({
      code: "email_not_confirmed", msg: "Email not confirmed",
    }) });
  });
  await page.goto("/login?next=%2Ffriends");
  await page.getByRole("textbox", { name: "Email" }).fill("rookline-qa@example.test");
  await page.getByLabel("Password").fill("one-long-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("p.status[role='alert']")).toContainText("Email not confirmed");
  expect(tokenRequests).toBe(1);
});

test("fragment confirmation fails safely without a valid session or external return URL", async ({ page }) => {
  await page.goto("/auth/callback?next=https%3A%2F%2Fevil.example#preview_error=expired&error=access_denied");
  await expect(page).toHaveURL(/\/auth\/complete\?next=%2Fplay%2Fonline$/);
  await expect(page.getByRole("heading", { name: "Could not confirm your email." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to sign in" })).toHaveAttribute(
    "href", "/login?error=confirmation&next=%2Fplay%2Fonline",
  );
  expect(page.url()).not.toContain("#");
});

test("fragment confirmation establishes a verified Supabase session and clears URL credentials", async ({ page }) => {
  test.skip(!browserAuthConfigured, "Public Supabase browser credentials are not configured in this build.");
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Offline test fixture" }),
  }));
  const jwtPayload = Buffer.from(JSON.stringify({
    aud: "authenticated", sub: "11111111-1111-4111-8111-111111111111",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${jwtPayload}.mock-signature`;
  const user = {
    id: "11111111-1111-4111-8111-111111111111", email: "rookline-qa@example.test",
    aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
  };
  let authenticatedUserCalls = 0;
  await page.route((url) => url.pathname.endsWith("/auth/v1/user"), (route) => {
    if (route.request().headers().authorization !== `Bearer ${token}`) {
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    }
    authenticatedUserCalls++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });
  // Return to a static local route so a mocked browser token is never
  // presented to the real hosted Supabase service by a server-rendered page.
  await page.goto(`/auth/callback?next=%2Fplay%2Flocal#access_token=${encodeURIComponent(token)}&refresh_token=mock-refresh-token&token_type=bearer&type=signup&expires_in=3600`);
  await expect(page).toHaveURL(/\/play\/local$/);
  expect(authenticatedUserCalls).toBeGreaterThan(0);
  expect(page.url()).not.toContain("#");
});
