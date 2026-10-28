import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { readFile } from "node:fs/promises";

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

test("local resignation exports a replayable PGN with the correct winner", async ({ page }) => {
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e4");
  await input.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Black resigned" })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PGN", exact: true }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe("rookline-game.pgn");
  const parsed = new Chess();
  parsed.loadPgn(await readFile(await downloaded.path(), "utf8"));
  expect(parsed.history()).toEqual(["e4"]);
  expect(parsed.getHeaders().Result).toBe("1-0");
  const archivePgn = await page.evaluate(() => {
    const archive = JSON.parse(localStorage.getItem("rookline-history") ?? "[]");
    return archive[0]?.pgn as string | undefined;
  });
  expect(archivePgn).toBeTruthy();
  const archived = new Chess();
  archived.loadPgn(archivePgn!);
  expect(archived.getHeaders().Result).toBe("1-0");
  expect(archived.history()).toEqual(["e4"]);

  await page.goto("/games");
  const localArchive = page.getByRole("region", { name: "Local game archive" });
  await expect(localArchive.getByText("Local game · Black resigned")).toBeVisible();
  const archiveDownload = page.waitForEvent("download");
  await localArchive.getByRole("button", { name: "Download PGN" }).click();
  const savedFile = await archiveDownload;
  const saved = new Chess();
  saved.loadPgn(await readFile(await savedFile.path(), "utf8"));
  expect(saved.getHeaders().Result).toBe("1-0");

  await localArchive.getByRole("link", { name: "Review game" }).click();
  await expect(page).toHaveURL(/\/analysis\?localGame=local-/);
  await expect(page.getByRole("status").filter({ hasText: "1 plies loaded from your local archive." })).toBeVisible();
  await expect(page.getByLabel("Analysis moves").getByText("e4")).toBeVisible();
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByText("0 / 1")).toBeVisible();
  const reviewExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PGN" }).click();
  const review = new Chess();
  review.loadPgn(await readFile(await (await reviewExport).path(), "utf8"));
  expect(review.history()).toEqual(["e4"]);
  expect(review.getHeaders().Result).toBe("1-0");
});

test("local archive ignores invalid storage and refuses corrupt replay PGN", async ({ page }) => {
  await page.goto("/games");
  await page.evaluate(() => localStorage.setItem("rookline-history", "{corrupted"));
  await page.reload();
  const localArchive = page.getByRole("region", { name: "Local game archive" });
  await expect(localArchive.getByText("No completed games saved on this device yet.")).toBeVisible();

  await page.evaluate(() => localStorage.setItem("rookline-history", JSON.stringify([{
    id: "local-corrupt-pgn", mode: "local", outcome: "Corrupted", date: new Date().toISOString(),
    pgn: "1. not-a-legal-move",
  }])));
  await page.reload();
  await localArchive.getByRole("link", { name: "Review game" }).click();
  await expect(page.getByRole("status").filter({ hasText: "This local game cannot be loaded." })).toBeVisible();
  await expect(page.getByText("0 / 0")).toBeVisible();
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
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PGN" }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe("rookline-analysis.pgn");
  const savedPgn = await readFile(await download.path(), "utf8");
  expect(savedPgn).toContain("Nf3 Nc6");
});

test("analysis keyboard moves validate legality and offer underpromotion", async ({ page }) => {
  await page.goto("/analysis");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e5");
  await input.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "not legal" })).toBeVisible();
  await input.fill("e2e4");
  await input.press("Enter");
  await expect(page.getByLabel("Analysis moves").getByText("e4")).toBeVisible();

  await page.getByRole("textbox", { name: "FEN position" }).fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Load FEN" }).click();
  await input.fill("a7a8");
  await input.press("Enter");
  await expect(page.getByRole("dialog", { name: "Choose promotion piece" })).toBeVisible();
  await page.getByRole("button", { name: "Promote to n" }).click();
  await expect(page.getByLabel("Analysis moves").getByText("a8=N")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Choose promotion piece" })).toHaveCount(0);

  await page.getByRole("button", { name: "Load FEN" }).click();
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  await expect(page.getByRole("dialog", { name: "Choose promotion piece" })).toBeVisible();
  await page.getByRole("button", { name: "Promote to q" }).click();
  await expect(page.getByLabel("Analysis moves").getByText(/a8=Q/)).toBeVisible();
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

test("a late move is refused even before a throttled clock interval fires", async ({ page }) => {
  await page.goto("/play/local");
  await page.getByRole("button", { name: "3+2" }).click();
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  await entry.fill("e2e4");
  await entry.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();

  // Simulate a suspended tab that resumes after Black's three-minute flag.
  // No browser interval is invoked between the time jump and the move.
  await page.evaluate(() => {
    const actualNow = performance.now.bind(performance);
    Object.defineProperty(performance, "now", { configurable: true, value: () => actualNow() + 181_000 });
  });
  await entry.fill("e7e5");
  await entry.press("Enter");
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("Timeout");
  await expect(page.getByLabel("Black clock")).toHaveText("00:00");
  await expect(page.getByLabel("Move history").getByText("e5")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "Time expired" })).toBeVisible();
});

test("keyboard-only coordinate entry validates and plays a local chess move", async ({ page }) => {
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e5");
  await input.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "not legal" })).toBeVisible();
  await input.fill("E2-E4");
  await input.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(input).toHaveValue("");
  await input.fill("e7e5");
  await input.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e5")).toBeVisible();
});

test("computer Undo keeps the opening bot move and restores the human clock", async ({ page }) => {
  await page.goto("/play/computer");
  await page.getByRole("button", { name: "3+2" }).click();
  await page.getByRole("button", { name: "easy", exact: true }).click();
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.locator('[data-square="e7"]').click();
  await page.locator('[data-square="e5"]').click();
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Black clock")).toHaveText("03:00");
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Black clock")).toHaveText("03:00");
});

test("game room ignores an old HTTP snapshot arriving after a newer ply", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000001";
  const chess = new Chess();
  const initialFen = chess.fen();
  chess.move("e4");
  const newerFen = chess.fen();
  const started = { id, white_id: "white-id", black_id: "black-id", status: "active", pgn: "", fen: initialFen,
    turn: "w", ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: new Date().toISOString(), result: null, winner_id: null, rated: false, created_at: new Date().toISOString() };
  const advanced = { ...started, pgn: chess.pgn(), fen: newerFen, turn: "b", ply: 1 };
  let requests = 0;
  let releaseOld: (() => void) | undefined;
  await page.route(`**/api/games/${id}`, async (route) => {
    requests++;
    const number = requests;
    if (number === 2) await new Promise<void>((resolve) => { releaseOld = resolve; });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      game: number <= 2 ? started : advanced, viewerColor: "w",
    }) });
  });
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  await page.getByRole("button", { name: "Sync" }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Sync" }).click();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  const staleResponse = page.waitForResponse(async (response) =>
    response.url().endsWith(`/api/games/${id}`) && response.status() === 200 && (await response.json()).game.ply === 0);
  releaseOld?.();
  await (await staleResponse).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
});

test("online room exports a parseable PGN with the authoritative result", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000003";
  const chess = new Chess();
  for (const san of ["f3", "e5", "g4", "Qh4#"]) chess.move(san);
  const game = {
    id, white_id: "white-id", black_id: "black-id", status: "completed",
    pgn: chess.pgn(), fen: chess.fen(), turn: chess.turn(), ply: 4,
    base_ms: 300000, increment_ms: 0, white_ms: 281000, black_ms: 290000,
    clock_anchor_at: null, result: "Checkmate", winner_id: "black-id",
    rated: false, created_at: new Date().toISOString(),
  };
  // This verifies UI/export behavior only; it is not a hosted multiplayer test.
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ game, viewerColor: "w" }),
  }));
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PGN" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`rookline-online-${id}.pgn`);
  const pgn = await readFile(await download.path(), "utf8");
  const parsed = new Chess();
  parsed.loadPgn(pgn);
  expect(parsed.fen()).toBe(chess.fen());
  expect(parsed.getHeaders().Result).toBe("0-1");
});

test("game room ignores a stale join prompt after a newer valid game response", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000002";
  const chess = new Chess();
  const game = { id, white_id: "white-id", black_id: "black-id", status: "active", pgn: "", fen: chess.fen(),
    turn: "w", ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: new Date().toISOString(), result: null, winner_id: null, rated: false, created_at: new Date().toISOString() };
  let requests = 0;
  let releaseOld: (() => void) | undefined;
  await page.route(`**/api/games/${id}`, async (route) => {
    requests++;
    const number = requests;
    if (number === 2) {
      await new Promise<void>((resolve) => { releaseOld = resolve; });
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ joinable: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ game, viewerColor: "w" }) });
    }
  });
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  await page.getByRole("button", { name: "Sync" }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Sync" }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(3);
  const staleResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/games/${id}`) && response.status() === 403);
  releaseOld?.();
  await (await staleResponse).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept challenge" })).toHaveCount(0);
});

test("baseline security headers are sent for document routes", async ({ request }) => {
  const response = await request.get("/settings");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
