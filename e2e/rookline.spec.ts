import { expect, test } from "@playwright/test";

test("home navigation and local chess legal moves", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make every move count." })).toBeVisible();
  await page.getByRole("link", { name: "Play chess", exact: true }).first().click();
  await page.getByRole("link", { name: /Over the board/ }).click();
  await expect(page.getByRole("heading", { name: "Local chess", level: 1 })).toBeVisible();
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await page.locator('[data-square="e7"]').click();
  await page.locator('[data-square="e5"]').click();
  await expect(page.getByLabel("Move history").getByText("e5")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Move history").getByText("e5")).toHaveCount(0);
});

test("puzzle solution validates against board rules", async ({ page }) => {
  await page.goto("/puzzles");
  await expect(page.getByRole("heading", { name: "The queen finishes" })).toBeVisible();
  await page.locator('[data-square="g6"]').click();
  await page.locator('[data-square="g7"]').click();
  await expect(page.getByText("Correct! Qxg7# is the answer.")).toBeVisible();
});

test("analysis imports PGN and navigates positions", async ({ page }) => {
  await page.goto("/analysis");
  await page.getByRole("textbox", { name: "PGN game" }).fill("1. e4 e5 2. Nf3 Nc6");
  await page.getByRole("button", { name: "Import PGN" }).click();
  await expect(page.getByText("4 plies imported successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByText("3 / 4")).toBeVisible();
});

test("online service fails clearly without credentials and mobile does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/play/online");
  await expect(page.getByText("Online service not configured")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto("/register");
  await expect(page.getByText("Online accounts are unavailable until Supabase environment variables are configured.")).toBeVisible();
});

test("game archive, leaderboard and profile expose truthful unconfigured states", async ({ page }) => {
  await page.goto("/games");
  await expect(page.getByRole("heading", { name: "Your game archive." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Online history is not configured" })).toBeVisible();
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rankings need a connected service" })).toBeVisible();
  await page.goto("/profile/rook_test");
  await expect(page.getByRole("heading", { name: "Profiles need a connected service." })).toBeVisible();
});

test("server denies cross-origin game mutations before using credentials", async ({ request }) => {
  const response = await request.post("/api/games", {
    headers: { Origin: "https://third-party.example", "Content-Type": "application/json" },
    data: { control: "5+0" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ error: "Cross-origin action denied" });
  const claim = await request.post("/api/games/00000000-0000-4000-8000-000000000001/claim", {
    headers: { Origin: "https://third-party.example", "Content-Type": "application/json" },
    data: { rule: "repetition", expectedPly: 8 },
  });
  expect(claim.status()).toBe(403);
  expect(await claim.json()).toMatchObject({ error: "Cross-origin action denied" });
});

test("draw claims fail closed without hosted chess credentials", async ({ request }) => {
  test.skip(!!(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
  "This fail-closed assertion applies only to an unconfigured local environment.");
  const claim = await request.post("/api/games/00000000-0000-4000-8000-000000000001/claim", {
    data: { rule: "repetition", expectedPly: 8 },
  });
  expect(claim.status()).toBe(503);
  expect(await claim.json()).toMatchObject({ error: "Chess service is not configured." });
});

test("opening explorer replays a legal line and switches openings", async ({ page }) => {
  await page.goto("/openings");
  await expect(page.getByRole("heading", { name: "Know your first moves." })).toBeVisible();
  await expect(page.getByText("Position 0 / 6")).toBeVisible();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.getByText("Position 1 / 6")).toBeVisible();
  await expect(page.locator("p[role='status']")).toHaveText("Claim space in the center.");
  await page.getByRole("button", { name: "Go to move 6: Bc5" }).click();
  await expect(page.getByText("Position 6 / 6")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next move" })).toBeDisabled();
  await page.getByRole("button", { name: /Sicilian Defense/ }).click();
  await expect(page.getByText("Position 0 / 7")).toBeVisible();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.locator("p[role='status']")).toHaveText("Claim e4 and d5.");
  await page.getByRole("button", { name: "Restart line" }).click();
  await expect(page.getByText("Position 0 / 7")).toBeVisible();
});

test("lesson explorer works on a small screen without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Learn one idea at a time." })).toBeVisible();
  await page.getByRole("button", { name: /Spot a mating threat/ }).click();
  await expect(page.getByText("Position 0 / 7")).toBeVisible();
  await page.getByRole("button", { name: "Go to move 7: Qxf7#" }).click();
  await expect(page.locator("p[role='status']")).toHaveText("The queen captures with checkmate.");
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByText("Position 6 / 7")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("settings persist theme and move sounds across navigation", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Make the board yours." })).toBeVisible();
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/theme-light/);
  await expect(page.getByRole("button", { name: "Use dark theme" })).toBeVisible();
  await page.getByRole("button", { name: "On", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "On", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/play/local");
  await expect(page.getByRole("button", { name: "Mute moves" })).toBeVisible();
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/theme-light/);
});

test("computer worker plays a legal first move when player chooses Black", async ({ page }) => {
  await page.goto("/play/computer");
  await page.getByRole("button", { name: "easy", exact: true }).click();
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("Black to move")).toBeVisible();
  await page.locator('[data-square="e7"]').click();
  await page.locator('[data-square="e5"]').click();
  await expect(page.getByLabel("Move history").getByText("e5")).toBeVisible();
});

test("corrupt browser saves do not crash a complete local game", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("rookline-session-local", JSON.stringify({ pgn: "", control: "5+0", seconds: { w: null, b: -1 }, gameId: "local-bad" }));
    localStorage.setItem("rookline-history", "{invalid JSON");
  });
  await page.goto("/play/local");
  for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
  }
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("Checkmate");
  expect(pageErrors).toEqual([]);
});

test("local threefold repetition requires the player to claim the draw", async ({ page }) => {
  await page.goto("/play/local");
  const claim = page.getByRole("button", { name: "Claim draw" });
  await expect(claim).toBeDisabled();
  const cycle = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]];
  for (let n = 0; n < 2; n++) {
    for (const [from, to] of cycle) {
      await page.locator(`[data-square="${from}"]`).click();
      await page.locator(`[data-square="${to}"]`).click();
    }
  }
  await expect(page.getByText("White to move")).toBeVisible();
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("Draw: claimed threefold repetition");
});

test("undo restores the previous chess clock and survives reload", async ({ page }) => {
  await page.goto("/play/local");
  await page.getByRole("button", { name: "3+2" }).click();
  await expect(page.getByLabel("White clock")).toHaveText("03:00");
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.getByLabel("White clock")).toHaveText("03:02");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("White clock")).toHaveText("03:00");
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("White clock")).toHaveText("03:00");
});

test("baseline security headers are sent for document routes", async ({ request }) => {
  const response = await request.get("/settings");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
