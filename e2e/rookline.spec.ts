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

test("undoing a completed local game withdraws its obsolete archive result", async ({ page }) => {
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e4");
  await input.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Black resigned" })).toBeVisible();
  const archiveLength = () => page.evaluate(() => JSON.parse(localStorage.getItem("rookline-history") ?? "[]").length as number);
  await expect.poll(archiveLength).toBe(1);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Move history").getByText("e4")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "White to move" })).toBeVisible();
  await expect.poll(archiveLength).toBe(0);
  await page.goto("/games");
  await expect(page.getByRole("region", { name: "Local game archive" }).getByText("No completed games saved on this device yet.")).toBeVisible();
});

test("resignation awards a draw when the opponent has only a king", async ({ page }) => {
  const setup = new Chess("4k3/8/8/8/8/8/8/4K2Q b - - 0 1");
  setup.move("Kd7");
  await page.addInitScript((pgn) => {
    localStorage.setItem("rookline-session-local", JSON.stringify({
      pgn, control: "5+0", seconds: { w: 300, b: 300 },
      manualResult: null, orientation: "white", playingSide: "w",
      undoClocks: [{ w: 300, b: 300 }], gameId: "local-resignation-draw",
    }));
  }, setup.pgn());

  await page.goto("/play/local");
  await expect(page.getByLabel("Move history").getByText("Kd7")).toBeVisible();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draw: resignation without mating material" })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PGN", exact: true }).click();
  const exported = new Chess();
  exported.loadPgn(await readFile(await (await pending).path(), "utf8"));
  expect(exported.history()).toEqual(["Kd7"]);
  expect(exported.getHeaders().Result).toBe("1/2-1/2");
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

test("puzzle keyboard input validates moves, records new tactics, and restores progress", async ({ page }) => {
  await page.goto("/puzzles");
  await page.getByRole("button", { name: "Puzzle 4", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Seal the back rank" })).toBeVisible();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("invalid");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Use coordinates" })).toBeVisible();
  await input.fill("e1f2");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "not legal" })).toBeVisible();
  await input.fill("e1e2");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "legal move" })).toBeVisible();
  await input.fill("e1e8");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! Re8#" })).toBeVisible();
  await expect(page.getByText("Solved 1 / 20 positions on this device.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Solved 1 / 20 positions on this device.")).toBeVisible();
  await page.getByRole("button", { name: "Puzzle 9", exact: true }).click();
  await input.fill("a7a8n");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "stronger tactic" })).toBeVisible();
  await input.fill("a7a8q");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! a8=Q+" })).toBeVisible();
  await expect(page.getByText("Solved 2 / 20 positions on this device.")).toBeVisible();
});

test("mate-in-one puzzle credits alternative correct checkmate", async ({ page }) => {
  await page.goto("/puzzles");
  await page.getByRole("button", { name: "Puzzle 2", exact: true }).click();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("f5f8");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! Qf8#" })).toBeVisible();
});

test("new Black-to-move puzzles orient the board and solve a mate and promotion", async ({ page }) => {
  await page.goto("/puzzles");
  await page.getByRole("button", { name: "Puzzle 12", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Black strikes the back rank" })).toBeVisible();
  const topLeft = await page.locator('[data-square="h1"]').boundingBox();
  const bottomRight = await page.locator('[data-square="a8"]').boundingBox();
  expect(topLeft).not.toBeNull();
  expect(bottomRight).not.toBeNull();
  expect(topLeft!.x).toBeLessThan(bottomRight!.x);
  expect(topLeft!.y).toBeLessThan(bottomRight!.y);
  await page.locator('[data-square="e8"]').click();
  await page.locator('[data-square="e1"]').click();
  await expect(page.getByRole("status").filter({ hasText: "Correct! Re1#" })).toBeVisible();
  await page.getByRole("button", { name: "Puzzle 18", exact: true }).click();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e1n");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "stronger tactic" })).toBeVisible();
  await input.fill("e2e1q");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! e1=Q+" })).toBeVisible();
  await expect(page.getByText("Solved 2 / 20 positions on this device.")).toBeVisible();
});

test("puzzle topic navigation prioritizes unsolved tactics and survives a reload", async ({ page }) => {
  await page.goto("/puzzles");
  await page.getByLabel("Practice topic").selectOption("Fork");
  await expect(page.getByRole("heading", { name: "Knight fork" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Puzzle 1", exact: true })).toHaveCount(0);
  await expect(page.getByText("Fork: 0 / 4 solved.")).toBeVisible();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e4d6");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! Nd6+" })).toBeVisible();
  await expect(page.getByText("Fork: 1 / 4 solved.")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByRole("heading", { name: "A second knight fork" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Solved 1 / 20 positions on this device.")).toBeVisible();
  await page.getByLabel("Practice topic").selectOption("Fork");
  await expect(page.getByRole("heading", { name: "A second knight fork" })).toBeVisible();
  await expect(page.getByText("Fork: 1 / 4 solved.")).toBeVisible();
});

test("adaptive puzzle review persists mistakes and revisits weak solved tactics", async ({ page }) => {
  await page.goto("/puzzles");
  await page.getByLabel("Practice topic").selectOption("Fork");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  for (let i = 0; i < 4; i++) {
    await input.fill("e4f6");
    await input.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "stronger tactic" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Hint" }).click();
  await page.evaluate(() => {
    const hint = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === "Hint");
    if (!hint) throw new Error("Hint button missing");
    hint.click();
    hint.click();
  });
  await input.fill("e4d6");
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct! Nd6+" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rookline-puzzle-practice") ?? "{}") ["fork-005"])).toEqual({ errors: 4, hints: 3, solves: 1 });
  await page.reload();
  await page.getByLabel("Practice topic").selectOption("Fork");
  await expect(page.getByRole("heading", { name: "A second knight fork" })).toBeVisible();
  await page.getByRole("button", { name: "Adaptive review off" }).click();
  await expect(page.getByRole("button", { name: "Adaptive review on" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Knight fork", exact: true })).toBeVisible();
  await input.fill("e4d6");
  await input.press("Enter");
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByRole("heading", { name: "A second knight fork" })).toBeVisible();
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

test("analysis position snapshot follows move navigation and detects mate", async ({ page }) => {
  await page.goto("/analysis");
  const insight = page.getByRole("region", { name: "Position insight" });
  await expect(insight.getByText("Turn: White · Status: Game in progress")).toBeVisible();
  await expect(insight.getByText("Material points: Even · Legal moves: 20")).toBeVisible();
  await page.getByRole("textbox", { name: "PGN game" }).fill("1. e4 d5 2. exd5");
  await page.getByRole("button", { name: "Import PGN" }).click();
  await expect(insight.getByText(/Material points: White \+1/)).toBeVisible();
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(insight.getByText(/Material points: Even/)).toBeVisible();
  await page.getByRole("textbox", { name: "PGN game" }).fill("1. f3 e5 2. g4 Qh4#");
  await page.getByRole("button", { name: "Import PGN" }).click();
  await expect(insight.getByText("Turn: White · Status: Checkmate — Black wins")).toBeVisible();
  await expect(insight.getByText(/Legal moves: 0/)).toBeVisible();
});

test("analysis candidate search uses a real worker, follows positions, and handles finished games", async ({ page }) => {
  await page.goto("/analysis");
  const region = page.getByRole("region", { name: "Candidate move analysis" });
  await region.getByRole("button", { name: "Find candidate move" }).click();
  await expect(region.getByText(/Candidate:/)).toContainText(/Heuristic estimate: .*depth 2 plies/, { timeout: 20_000 });
  await page.getByRole("textbox", { name: /Keyboard move/ }).fill("e2e4");
  await page.getByRole("textbox", { name: /Keyboard move/ }).press("Enter");
  await expect(region.getByText(/Candidate:/)).toHaveCount(0);
  await region.getByRole("button", { name: "Find candidate move" }).click();
  await expect(region.getByText(/Candidate:/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("textbox", { name: "PGN game" }).fill("1. f3 e5 2. g4 Qh4#");
  await page.getByRole("button", { name: "Import PGN" }).click();
  await expect(region.getByText(/Candidate:/)).toHaveCount(0);
  await region.getByRole("button", { name: "Find candidate move" }).click();
  await expect(region.getByText("This game is finished. No further move is suggested.")).toBeVisible({ timeout: 20_000 });
  const repeated = Array.from({ length: 4 }, (_, i) =>
    `${i * 2 + 1}. Nf3 Nf6 ${i * 2 + 2}. Ng1 Ng8`).join(" ");
  await page.getByRole("textbox", { name: "PGN game" }).fill(repeated);
  await page.getByRole("button", { name: "Import PGN" }).click();
  await region.getByRole("button", { name: "Find candidate move" }).click();
  await expect(region.getByText("This game is finished. No further move is suggested.")).toBeVisible({ timeout: 20_000 });
});

test("analysis worker looks past an immediately recaptured queen", async ({ page }) => {
  await page.goto("/analysis");
  await page.getByRole("textbox", { name: "FEN position" }).fill("5rk1/8/6n1/5p2/4Q3/8/8/6K1 w - - 0 1");
  await page.getByRole("button", { name: "Load FEN" }).click();
  const region = page.getByRole("region", { name: "Candidate move analysis" });
  await region.getByRole("button", { name: "Find candidate move" }).click();
  const candidate = region.getByText(/Candidate:/);
  await expect(candidate).toBeVisible({ timeout: 20_000 });
  await expect(candidate).not.toContainText("Candidate: Qxf5");
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
  await page.getByRole("button", { name: "Promote to knight" }).click();
  await expect(page.getByLabel("Analysis moves").getByText("a8=N")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Choose promotion piece" })).toHaveCount(0);

  await page.getByRole("button", { name: "Load FEN" }).click();
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  await expect(page.getByRole("dialog", { name: "Choose promotion piece" })).toBeVisible();
  await page.getByRole("button", { name: "Promote to queen" }).click();
  await expect(page.getByLabel("Analysis moves").getByText(/a8=Q/)).toBeVisible();
});

test("analysis promotion traps keyboard focus, cancels on Escape, and restores the move input", async ({ page }) => {
  await page.goto("/analysis");
  await page.getByRole("textbox", { name: "FEN position" }).fill("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Load FEN" }).click();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("a7a8");
  await input.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Choose promotion piece" });
  const queen = dialog.getByRole("button", { name: "Promote to queen" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await expect(dialog).toBeVisible();
  await expect(queen).toBeFocused();
  await queen.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await cancel.press("Tab");
  await expect(queen).toBeFocused();
  await queen.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(page.getByLabel("Analysis moves").getByText("a8=Q")).toHaveCount(0);

  await input.fill("a7a8");
  await input.press("Enter");
  await expect(queen).toBeFocused();
  await queen.press("Tab");
  await expect(dialog.getByRole("button", { name: "Promote to rook" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const knight = dialog.getByRole("button", { name: "Promote to knight" });
  await expect(knight).toBeFocused();
  await knight.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(page.getByLabel("Analysis moves").getByText("a8=N")).toBeVisible();
});

test("local promotion is keyboard accessible and cancel preserves the position", async ({ page }) => {
  // Keep a rook on the board so underpromoting to a knight does not end
  // the game by insufficient material and disable the input being restored.
  const setup = new Chess("4k2r/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.addInitScript((pgn) => {
    localStorage.setItem("rookline-session-local", JSON.stringify({
      pgn, control: "5+0", seconds: { w: 300, b: 300 },
      manualResult: null, orientation: "white", playingSide: "w",
      undoClocks: [], gameId: "local-keyboard-promotion",
    }));
  }, setup.pgn());
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("a7a8");
  await input.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose promotion piece" });
  await expect(dialog.getByRole("button", { name: "Promote to queen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(page.getByLabel("Move history").getByText("a8=Q")).toHaveCount(0);

  await input.fill("a7a8");
  await input.press("Enter");
  await dialog.getByRole("button", { name: "Promote to knight" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(page.getByLabel("Move history").getByText("a8=N")).toBeVisible();
});

test("promotion ending a local game restores focus to an available action", async ({ page }) => {
  const setup = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.addInitScript((pgn) => {
    localStorage.setItem("rookline-session-local", JSON.stringify({
      pgn, control: "5+0", seconds: { w: 300, b: 300 },
      manualResult: null, orientation: "white", playingSide: "w",
      undoClocks: [], gameId: "local-final-promotion",
    }));
  }, setup.pgn());
  await page.goto("/play/local");
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("a7a8");
  await input.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose promotion piece" });
  await expect(dialog.getByRole("button", { name: "Promote to queen" })).toBeFocused();
  await dialog.getByRole("button", { name: "Promote to knight" }).press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "PGN", exact: true })).toBeFocused();
  await expect(page.getByLabel("Move history").getByText("a8=N")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Save profile" })).toHaveCount(0);
});

test("profile update requires same-origin intent and an authenticated service", async ({ request }) => {
  const thirdParty = await request.patch("/api/profile", {
    headers: { Origin: "https://third-party.example", "Content-Type": "application/json" },
    data: { username: "rook_player", display_name: "Player" },
  });
  expect(thirdParty.status()).toBe(403);
  expect(await thirdParty.json()).toMatchObject({ error: "Cross-origin action denied" });
  const unconfigured = await request.patch("/api/profile", {
    headers: { Origin: "http://127.0.0.1:3100", "Content-Type": "application/json" },
    data: { username: "rook_player", display_name: "Player" },
  });
  expect(unconfigured.status()).toBe(503);
  expect(await unconfigured.json()).toMatchObject({ error: "Profiles are unavailable" });
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
  const cancel = await request.post("/api/games/00000000-0000-4000-8000-000000000001/cancel", {
    headers: { Origin: "https://third-party.example" },
  });
  expect(cancel.status()).toBe(403);
  expect(await cancel.json()).toMatchObject({ error: "Cross-origin action denied" });
  const missingOrigin = await request.post("/api/games", { data: { control: "5+0" } });
  expect(missingOrigin.status()).toBe(403);
  const siblingSite = await request.post("/api/games", {
    headers: { "Sec-Fetch-Site": "same-site" }, data: { control: "5+0" },
  });
  expect(siblingSite.status()).toBe(403);
});

test("draw claims fail closed without hosted chess credentials", async ({ request }) => {
  test.skip(!!(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
  "This fail-closed assertion applies only to an unconfigured local environment.");
  const claim = await request.post("/api/games/00000000-0000-4000-8000-000000000001/claim", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { rule: "repetition", expectedPly: 8 },
  });
  expect(claim.status(), await claim.text()).toBe(503);
  expect(await claim.json()).toMatchObject({ error: "Chess service is not configured." });
  const cancel = await request.post("/api/games/00000000-0000-4000-8000-000000000001/cancel", {
    headers: { Origin: "http://127.0.0.1:3100" },
  });
  expect(cancel.status()).toBe(503);
  expect(await cancel.json()).toMatchObject({ error: "Chess service is not configured." });
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

test("opening practice rejects wrong moves, guides White, and saves mastered progress", async ({ page }) => {
  await page.goto("/openings");
  await page.getByRole("button", { name: "Practice as White" }).click();
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  const feedback = page.locator("p[role='status']");
  await entry.fill("e2e5");
  await entry.press("Enter");
  await expect(feedback).toContainText("Illegal move");
  await entry.fill("d2d4");
  await entry.press("Enter");
  await expect(feedback).toContainText("Legal move, but this line");
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(feedback).toContainText("Hint: play e4");
  for (const [input, position] of [["e2e4", 2], ["g1f3", 4], ["f1c4", 6]] as const) {
    await entry.fill(input);
    await entry.press("Enter");
    await expect(page.getByText(`Practice position ${position} / 6`)).toBeVisible();
  }
  await expect(feedback).toContainText("Line complete!");
  await expect(entry).toBeDisabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rookline-study-practice") || "[]"))).toContain("italian:w");
  await page.reload();
  await expect(page.getByText("Practice completed on this device")).toBeVisible();
  await page.getByRole("button", { name: "Practice as White" }).click();
  await expect(page.getByText("This line is mastered.", { exact: false })).toBeVisible();
});

test("opening practice lets Black reply to scripted White and restart", async ({ page }) => {
  await page.goto("/openings");
  await page.getByRole("button", { name: "Practice as Black" }).click();
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  await expect(page.getByText("Practice position 1 / 6")).toBeVisible();
  await entry.fill("e7e5");
  await entry.press("Enter");
  await expect(page.getByText("Practice position 3 / 6")).toBeVisible();
  await page.getByRole("button", { name: "Retry line" }).click();
  await expect(page.getByText("Practice position 1 / 6")).toBeVisible();
  for (const [input, position] of [["e7e5", 3], ["b8c6", 5], ["f8c5", 6]] as const) {
    await entry.fill(input);
    await entry.press("Enter");
    await expect(page.getByText(`Practice position ${position} / 6`)).toBeVisible();
  }
  await expect(page.locator("p[role='status']")).toContainText("Line complete!");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rookline-study-practice") || "[]"))).toContain("italian:b");
  await page.getByRole("button", { name: "Review moves" }).click();
  await expect(page.getByText("Position 0 / 6", { exact: true })).toBeVisible();
});

test("lesson practice preserves completed openings across page navigation", async ({ page }) => {
  await page.goto("/openings");
  await page.getByRole("button", { name: "Practice as White" }).click();
  const openingInput = page.getByRole("textbox", { name: /Keyboard move/ });
  for (const move of ["e2e4", "g1f3", "f1c4"]) {
    await openingInput.fill(move);
    await openingInput.press("Enter");
  }
  await expect(page.locator("p[role='status']")).toContainText("Line complete!");

  await page.goto("/learn");
  await page.getByRole("button", { name: "Practice as White" }).click();
  const lessonInput = page.getByRole("textbox", { name: /Keyboard move/ });
  for (const move of ["e2e4", "g1f3", "f1c4"]) {
    await lessonInput.fill(move);
    await lessonInput.press("Enter");
  }
  await expect(page.locator("p[role='status']")).toContainText("Line complete!");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rookline-study-practice") || "[]")))
    .toEqual(expect.arrayContaining(["italian:w", "develop:w"]));

  await page.goto("/openings");
  await expect(page.getByText("Practice completed on this device")).toBeVisible();
  await page.goto("/learn");
  await expect(page.getByText("Practice completed on this device")).toBeVisible();
});

test("new French defense and king-safety lesson are playable and retain separate mastery", async ({ page }) => {
  await page.goto("/openings");
  await page.getByRole("button", { name: /French Defense/ }).click();
  await page.getByRole("button", { name: "Practice as Black" }).click();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  for (const [move, ply] of [["e7e6", 3], ["d7d5", 5], ["g8f6", 6]] as const) {
    await input.fill(move);
    await input.press("Enter");
    await expect(page.getByText(`Practice position ${ply} / 6`)).toBeVisible();
  }
  await expect(page.locator("p[role='status']")).toContainText("Line complete!");

  await page.goto("/learn");
  await page.getByRole("button", { name: /Castle before complications/ }).click();
  await page.getByRole("button", { name: "Practice as White" }).click();
  const lessonInput = page.getByRole("textbox", { name: /Keyboard move/ });
  for (const [move, ply] of [["e2e4", 2], ["g1f3", 4], ["f1c4", 6], ["e1g1", 8], ["d2d3", 10]] as const) {
    await lessonInput.fill(move);
    await lessonInput.press("Enter");
    await expect(page.getByText(`Practice position ${ply} / 10`)).toBeVisible();
  }
  await expect(page.locator("p[role='status']")).toContainText("Line complete!");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rookline-study-practice") || "[]")))
    .toEqual(expect.arrayContaining(["french:b", "castle:w"]));
  await page.reload();
  await page.getByRole("button", { name: /Castle before complications/ }).click();
  await expect(page.getByText("Practice completed on this device")).toBeVisible();
  await page.getByRole("button", { name: "Practice as White" }).click();
  await expect(page.getByText("This line is mastered.", { exact: false })).toBeVisible();
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

test("move audio defaults on, plays from keyboard and persists mute across navigation", async ({ page }) => {
  await page.addInitScript(() => {
    const audioWindow = window as unknown as Window & { __rooklineAudioStarts: number };
    audioWindow.__rooklineAudioStarts = 0;
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          type: "triangle", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() { return { connect() {} }; }, disconnect() {},
          start() { audioWindow.__rooklineAudioStarts++; }, stop() {}, onended: null,
        };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, disconnect() {} };
      }
      resume() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { value: FakeAudioContext });
  });
  const played = () => page.evaluate(() => (window as unknown as Window & { __rooklineAudioStarts: number }).__rooklineAudioStarts);
  await page.goto("/play/local");
  await expect(page.getByRole("button", { name: "Mute moves" })).toBeVisible();
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill("e2e4"); await input.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  expect(await played()).toBe(1);
  await page.getByRole("button", { name: "Mute moves" }).click();
  await input.fill("e7e5"); await input.press("Enter");
  expect(await played()).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Enable move sounds" })).toBeVisible();
  await page.getByRole("button", { name: "Enable move sounds" }).click();
  expect(await played()).toBe(1); // Page reload resets the per-document audio spy; the toggle previews the sound.
  await input.fill("g1f3"); await input.press("Enter");
  expect(await played()).toBe(2);
});

test("online room rings once for each newly synchronized opponent move", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000099";
  const chess = new Chess();
  let game = {
    id, white_id: "white-id", black_id: "black-id", status: "active", pgn: chess.pgn(), fen: chess.fen(),
    turn: chess.turn(), ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000,
    black_ms: 300000, clock_anchor_at: new Date().toISOString(),
    result: null, winner_id: null, rated: false, created_at: new Date().toISOString(),
  };
  await page.addInitScript(() => {
    const audioWindow = window as unknown as Window & { __rooklineAudioStarts: number };
    audioWindow.__rooklineAudioStarts = 0;
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return { type: "triangle", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() { return { connect() {} }; }, disconnect() {},
          start() { audioWindow.__rooklineAudioStarts++; }, stop() {}, onended: null };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, disconnect() {} }; }
      resume() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { value: FakeAudioContext });
  });
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ game, viewerColor: "b" }),
  }));
  const played = () => page.evaluate(() => (window as unknown as Window & { __rooklineAudioStarts: number }).__rooklineAudioStarts);
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  expect(await played()).toBe(0); // Opening an existing room should be silent.
  chess.move("e4");
  game = { ...game, pgn: chess.pgn(), fen: chess.fen(), ply: 1, turn: chess.turn() };
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  expect(await played()).toBe(1);
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  expect(await played()).toBe(1); // Polling the same ply is silent.
  await page.getByRole("button", { name: "Mute moves" }).click();
  chess.move("e5");
  game = { ...game, pgn: chess.pgn(), fen: chess.fen(), ply: 2, turn: chess.turn() };
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByLabel("Move history").getByText("e5")).toBeVisible();
  expect(await played()).toBe(1);
});

test("online room does not sound an inconsistent server ledger before a valid move arrives", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000098";
  const chess = new Chess();
  const initial = {
    id, white_id: "white-id", black_id: "black-id", status: "active", pgn: chess.pgn(), fen: chess.fen(),
    turn: chess.turn(), ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000,
    black_ms: 300000, clock_anchor_at: new Date().toISOString(), result: null, winner_id: null,
    rated: false, created_at: new Date().toISOString(),
  };
  chess.move("e4");
  const valid = { ...initial, pgn: chess.pgn(), fen: chess.fen(), ply: 1, turn: chess.turn() };
  const inconsistent = { ...valid, pgn: "" };
  let snapshot = initial;
  await page.addInitScript(() => {
    const audioWindow = window as unknown as Window & { __audioPlays: number };
    audioWindow.__audioPlays = 0;
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator() {
        return { type: "triangle", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() { return { connect() {} }; }, disconnect() {},
          start() { audioWindow.__audioPlays++; }, stop() {}, onended: null };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, disconnect() {} }; }
      resume() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { value: FakeAudioContext });
  });
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ game: snapshot, viewerColor: "b" }),
  }));
  const played = () => page.evaluate(() => (window as unknown as Window & { __audioPlays: number }).__audioPlays);
  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  snapshot = inconsistent;
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByText("Server game ledger could not be verified. Stop play and contact support.")).toBeVisible();
  expect(await played()).toBe(0);
  snapshot = valid;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  expect(await played()).toBe(1);
});

test("original Rookline mark appears on desktop, mobile and the browser icon", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sidebar .brand svg[aria-label='Rookline logo']")).toBeVisible();
  const favicon = page.locator('head link[rel="icon"]').first();
  await expect(favicon).toHaveAttribute("href", /\/icon\.svg/);
  const icon = await page.request.get(await favicon.getAttribute("href") ?? "/icon.svg");
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('fill="#193C33"');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("link", { name: "Rookline home" })).toBeVisible();
  await expect(page.locator(".topbar .mobile-brand svg[aria-label='Rookline logo']")).toBeVisible();
  const right = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(right).toBe(true);
});

test("expired confirmation links surface a useful sign-in error", async ({ page }) => {
  await page.goto("/login?error=confirmation&next=%2Fplay%2Fonline");
  await expect(page.locator(".status[role='alert']")).toContainText("confirmation link is invalid or has expired");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register?next=%2Fplay%2Fonline");
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

test("real medium computer worker chooses a developing opening and accepts the reply", async ({ page }) => {
  await page.goto("/play/computer");
  await page.getByRole("button", { name: "Black", exact: true }).click();
  const firstMove = page.getByLabel("Move history").locator(".move-row strong").first();
  await expect(firstMove).toHaveText(/^(d4|e4|Nf3|Nc3)$/, { timeout: 20_000 });
  await expect(page.getByText("Black to move")).toBeVisible();
  const pgn = await page.evaluate(() => JSON.parse(localStorage.getItem("rookline-session-computer") ?? "{}")?.pgn as string | undefined);
  expect(pgn).toBeTruthy();
  const game = new Chess();
  game.loadPgn(pgn!);
  const move = game.moves({ verbose: true })[0];
  const input = page.getByRole("textbox", { name: /Keyboard move/ });
  await input.fill(`${move.from}${move.to}${move.promotion ?? ""}`);
  await input.press("Enter");
  await expect(page.getByLabel("Move history").locator(".move-row strong")).toHaveCount(2);
});

test("a stale computer worker error cannot interrupt a new game", async ({ page }) => {
  await page.addInitScript(() => {
    class ControlledWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      request = 0;
      constructor() { workers.push(this); }
      postMessage(data: { request: number }) { this.request = data.request; }
      terminate() { /* Keep a queued error deliverable after termination. */ }
      emitError() { this.onerror?.(new Event("error")); }
      emitMove() {
        this.onmessage?.(new MessageEvent("message", {
          data: { request: this.request, move: { from: "e2", to: "e4" } },
        }));
      }
    }
    const workers: ControlledWorker[] = [];
    Object.assign(window, { Worker: ControlledWorker, __rooklineTestWorkers: workers });
  });
  await page.goto("/play/computer");
  await page.getByRole("button", { name: "Black", exact: true }).click();
  const workerCount = () => page.evaluate(() =>
    (window as typeof window & { __rooklineTestWorkers: unknown[] }).__rooklineTestWorkers.length);
  await expect.poll(workerCount).toBe(1);
  await page.getByRole("button", { name: "New game" }).click();
  await expect.poll(workerCount).toBe(2);

  await page.evaluate(() => {
    const workers = (window as typeof window & {
      __rooklineTestWorkers: { emitError(): void; emitMove(): void }[];
    }).__rooklineTestWorkers;
    workers[0].emitError();
  });
  await expect(page.getByRole("alert").filter({ hasText: "Computer engine could not start" })).toHaveCount(0);
  await page.evaluate(() => {
    const workers = (window as typeof window & {
      __rooklineTestWorkers: { emitMove(): void }[];
    }).__rooklineTestWorkers;
    workers[1].emitMove();
  });
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(page.getByText("Black to move")).toBeVisible();
});

test("an invalid computer worker move reports failure and can recover on reset", async ({ page }) => {
  await page.addInitScript(() => {
    class ControlledWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      request = 0;
      constructor() { workers.push(this); }
      postMessage(data: { request: number }) { this.request = data.request; }
      terminate() { /* Do not discard an already queued worker reply. */ }
      emitMove(from: string, to: string) {
        this.onmessage?.(new MessageEvent("message", {
          data: { request: this.request, move: { from, to } },
        }));
      }
    }
    const workers: ControlledWorker[] = [];
    Object.assign(window, { Worker: ControlledWorker, __rooklineTestWorkers: workers });
  });

  await page.goto("/play/computer");
  await page.getByRole("button", { name: "Black", exact: true }).click();
  const count = () => page.evaluate(() =>
    (window as typeof window & { __rooklineTestWorkers: unknown[] }).__rooklineTestWorkers.length);
  await expect.poll(count).toBe(1);
  await page.evaluate(() => {
    const workers = (window as typeof window & {
      __rooklineTestWorkers: { emitMove(from: string, to: string): void }[];
    }).__rooklineTestWorkers;
    workers[0].emitMove("e7", "e5"); // Black's move while the worker owns White's turn.
  });
  await expect(page.getByRole("alert").filter({ hasText: "Computer returned an invalid move" })).toBeVisible();
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(0);

  await page.getByRole("button", { name: "New game" }).click();
  await expect.poll(count).toBe(2);
  await page.evaluate(() => {
    const workers = (window as typeof window & {
      __rooklineTestWorkers: { emitMove(from: string, to: string): void }[];
    }).__rooklineTestWorkers;
    workers[1].emitMove("e2", "e4");
  });
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(page.getByText("Black to move")).toBeVisible();
});

test("resigning while the computer thinks resigns the human side", async ({ page }) => {
  await page.addInitScript(() => {
    class WaitingWorker {
      postMessage() { /* The computer is still thinking. */ }
      terminate() { /* No pending reply. */ }
    }
    Object.assign(window, { Worker: WaitingWorker });
  });
  await page.goto("/play/computer");
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  await entry.fill("e2e4");
  await entry.press("Enter");
  await expect(page.getByText("Computer is thinking…")).toBeVisible();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("White resigned");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PGN", exact: true }).click();
  const exported = new Chess();
  exported.loadPgn(await readFile(await (await pending).path(), "utf8"));
  expect(exported.getHeaders().Result).toBe("0-1");
});

test("the human cannot claim a computer-turn repetition draw", async ({ page }) => {
  const game = new Chess();
  for (const san of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8", "Nf3"]) game.move(san);
  expect(game.isThreefoldRepetition()).toBe(true);
  await page.addInitScript((pgn) => {
    class WaitingWorker {
      postMessage() { /* Keep Black's turn pending. */ }
      terminate() { /* No pending reply. */ }
    }
    Object.assign(window, { Worker: WaitingWorker });
    localStorage.setItem("rookline-session-computer", JSON.stringify({
      pgn, control: "5+0", seconds: { w: 300, b: 300 },
      manualResult: null, orientation: "white", playingSide: "w",
      gameId: "local-computer-draw-turn", undoClocks: Array.from({ length: 9 }, () => ({ w: 300, b: 300 })),
    }));
  }, game.pgn());
  await page.goto("/play/computer");
  await expect(page.getByLabel("Move history").getByText("Nf3").last()).toBeVisible();
  await expect(page.getByText("Computer is thinking…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim draw" })).toBeDisabled();
});

test("corrupt browser saves do not crash a complete local game", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("rookline-corruption-seeded")) return;
    sessionStorage.setItem("rookline-corruption-seeded", "true");
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
  // A corrupted previous archive must not silently lose the newly completed game.
  await expect.poll(() => page.evaluate(() => {
    try {
      const games = JSON.parse(localStorage.getItem("rookline-history") ?? "[]");
      return Array.isArray(games) && games.some((entry) => entry.outcome === "Checkmate" && entry.mode === "local");
    } catch { return false; }
  })).toBe(true);
  await page.goto("/games");
  await expect(page.getByRole("region", { name: "Local game archive" }).getByText("Local game · Checkmate")).toBeVisible();
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

test("a long-running local clock stores precise time without rewriting its PGN every 250 ms", async ({ page }) => {
  await page.goto("/play/local");
  await page.getByRole("button", { name: "3+2" }).click();
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  await entry.fill("e2e4");
  await entry.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("rookline-session-local") ?? "{}").running)).toBe(true);

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    Object.assign(window, { __rooklineClockWrites: () => writes });
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "rookline-session-local") writes++;
      return original.call(this, key, value);
    };
  });
  await page.waitForTimeout(2800);
  const counts = await page.evaluate(() => {
    const writes = (window as typeof window & { __rooklineClockWrites: () => number }).__rooklineClockWrites();
    const save = JSON.parse(localStorage.getItem("rookline-session-local")!);
    return { writes, savedSeconds: save.seconds.b as number, savedPgn: save.pgn as string };
  });
  expect(counts.writes).toBeLessThanOrEqual(5);
  expect(counts.writes).toBeGreaterThanOrEqual(2);
  expect(counts.savedSeconds).toBeGreaterThan(176);
  expect(counts.savedSeconds).toBeLessThan(179);
  expect(counts.savedPgn).toContain("e4");
  await page.reload();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(page.getByLabel("Black clock")).toContainText("02:5");
});

test("an active local clock charges elapsed time across reload and rejects an expired turn", async ({ page }) => {
  // Apply each simulated wall-clock jump before the app mounts on reload.
  // Editing the save on a live page races its 250 ms persistence interval.
  await page.addInitScript(() => {
    const jump = localStorage.getItem("rookline-test-reload-jump");
    if (!jump) return;
    localStorage.removeItem("rookline-test-reload-jump");
    const snapshot = JSON.parse(localStorage.getItem("rookline-session-local")!);
    snapshot.savedAt = Date.now() - Number(jump);
    localStorage.setItem("rookline-session-local", JSON.stringify(snapshot));
  });
  await page.goto("/play/local");
  await page.getByRole("button", { name: "3+2" }).click();
  const entry = page.getByRole("textbox", { name: /Keyboard move/ });
  await entry.fill("e2e4");
  await entry.press("Enter");
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("rookline-session-local") ?? "{}").running)).toBe(true);

  // Last persisted tick was 42 seconds before the browser was reloaded.
  await page.evaluate(() => localStorage.setItem("rookline-test-reload-jump", "42000"));
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    const { seconds, running } = JSON.parse(localStorage.getItem("rookline-session-local")!);
    return running && seconds.b < 140 && seconds.b > 130;
  })).toBe(true);
  await expect(page.getByLabel("Black clock")).toContainText("02:1");

  await page.evaluate(() => localStorage.setItem("rookline-test-reload-jump", "200000"));
  await page.reload();
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("Timeout");
  await expect(page.getByLabel("Black clock")).toHaveText("00:00");
  await expect(entry).toBeDisabled();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
});

test("a resumed computer game does not answer after its clock expired during reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rookline-session-computer", JSON.stringify({
      pgn: "1. e4", control: "3+2", seconds: { w: 182, b: 180 },
      manualResult: null, orientation: "white", playingSide: "w",
      gameId: "local-computer-expired", undoClocks: [{ w: 180, b: 180 }],
      running: true, savedAt: Date.now() - 200_000,
    }));
  });
  await page.goto("/play/computer");
  await expect(page.getByLabel("Game controls").locator('[role="status"]')).toHaveText("Timeout");
  await expect(page.getByLabel("Black clock")).toHaveText("00:00");
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1);
  await page.waitForTimeout(900);
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(1);
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
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
  // A pending interval may flag the clock before form submission. In that
  // ordering the input is disabled before an additional alert is rendered.
  await expect(entry).toBeDisabled();
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
  // Wait for the computer's reply: three plies occupy two move rows.
  // The worker can answer before the first assertion on a fast machine.
  await expect(page.getByLabel("Move history").locator(".move-row")).toHaveCount(2, { timeout: 20_000 });
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

test("online clock uses server time even when the device clock is an hour fast", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000011";
  const anchor = new Date().toISOString();
  const game = { id, white_id: "white-id", black_id: "black-id", status: "active",
    pgn: "", fen: new Chess().fen(), turn: "w", ply: 0,
    base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: anchor, result: null, winner_id: null, rated: false, created_at: anchor };

  await page.addInitScript(() => {
    const actualNow = Date.now.bind(Date);
    Date.now = () => actualNow() + 60 * 60 * 1000;
  });
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ game, viewerColor: "w", serverNow: Date.now() }),
  }));

  await page.goto(`/game/${id}`);
  await expect(page.getByRole("heading", { name: "Your game room" })).toBeVisible();
  await expect(page.getByLabel("White clock")).toHaveText(/^0[45]:[0-5]\d$/);
  await expect(page.getByLabel("Black clock")).toHaveText("05:00");
  // A second wall-clock adjustment must not affect a clock driven by performance.now().
  await page.evaluate(() => { Date.now = () => 0; });
  await expect(page.getByLabel("White clock")).toHaveText(/^0[45]:[0-5]\d$/);
});

test("an outdated game snapshot or server timestamp cannot rewind the online display clock", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000012";
  const sample = Date.now();
  const anchor = new Date(sample - 20_000).toISOString();
  const chess = new Chess();
  const first = { id, white_id: "white-id", black_id: "black-id", status: "active",
    pgn: "", fen: chess.fen(), turn: "w", ply: 0,
    base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: anchor, result: null, winner_id: null, rated: false, created_at: anchor };
  chess.move("e4");
  const moved = { ...first, pgn: chess.pgn(), fen: chess.fen(), ply: 1, turn: "b",
    white_ms: 280000, clock_anchor_at: anchor };
  let requests = 0;
  await page.route(`**/api/games/${id}`, (route) => {
    requests++;
    const game = requests === 1 || requests === 3 ? first : moved;
    const serverNow = requests <= 2 ? sample : sample - 60_000;
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ game, viewerColor: "w", serverNow }) });
  });
  await page.goto(`/game/${id}`);
  await expect(page.getByLabel("White clock")).toHaveText(/^04:4\d$/);
  await page.getByRole("button", { name: "Sync" }).click();
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(page.getByLabel("Black clock")).toHaveText(/^04:4\d$/);

  // A later HTTP request returns an older ply, then an unchanged ply with an
  // older serverNow. Neither is allowed to reset the advanced game's clock.
  await page.getByRole("button", { name: "Sync" }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Sync" }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(4);
  await expect(page.getByLabel("Move history").getByText("e4")).toBeVisible();
  await expect(page.getByLabel("Black clock")).toHaveText(/^04:4\d$/);
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

  // Review is fetched again from the protected API, never from URL-supplied PGN.
  await page.getByRole("link", { name: "Analyze game" }).click();
  await expect(page).toHaveURL(`/analysis?onlineGame=${id}`);
  await expect(page.getByRole("status").filter({ hasText: "4 plies loaded from your completed online game." })).toBeVisible();
  await expect(page.getByText("4 / 4")).toBeVisible();
  await expect(page.getByLabel("Analysis moves").getByText("Qh4#")).toBeVisible();
  const reviewDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PGN" }).click();
  const reviewed = new Chess();
  reviewed.loadPgn(await readFile(await (await reviewDownload).path(), "utf8"));
  expect(reviewed.history()).toEqual(chess.history());
  expect(reviewed.getHeaders().Result).toBe("0-1");

  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByText("3 / 4")).toBeVisible();
  await page.getByRole("textbox", { name: /Keyboard move/ }).fill("g8f6");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByLabel("Analysis moves").getByText("Nf6")).toBeVisible();
  await expect(page.getByLabel("Analysis moves").getByText("Qh4#")).toHaveCount(0);
});

test("online analysis rejects untrusted links and unfinished or corrupt snapshots", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000018";
  let calls = 0;
  await page.route("**/api/games/**", (route) => {
    calls++;
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ game: { id, status: "active" } }) });
  });
  await page.goto("/analysis?onlineGame=../../bad");
  await expect(page.getByRole("status").filter({ hasText: "Invalid online game link." })).toBeVisible();
  expect(calls).toBe(0);
  await page.goto(`/analysis?onlineGame=${id}`);
  await expect(page.getByRole("status").filter({ hasText: "This online game could not be verified for analysis." })).toBeVisible();
  await expect(page.getByText("0 / 0")).toBeVisible();
  expect(calls).toBe(1);
});

test("online analysis handles expired sign-in and inaccessible games", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000019";
  let responseCode = 401;
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({ status: responseCode,
    contentType: "application/json", body: JSON.stringify({ error: "Unavailable" }) }));
  await page.goto(`/analysis?onlineGame=${id}`);
  await expect(page.getByRole("status").filter({ hasText: "Sign in to review your online game." })).toBeVisible();
  responseCode = 403;
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "This game is unavailable or you are not a participant." })).toBeVisible();
  await expect(page.getByText("0 / 0")).toBeVisible();
});

test("challenge creator can cancel a waiting invitation and sees its final state", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000004";
  const initial = new Chess();
  const waitingGame = {
    id, white_id: "white-id", black_id: null, status: "waiting", pgn: "", fen: initial.fen(),
    turn: "w", ply: 0, base_ms: 300000, increment_ms: 0, white_ms: 300000, black_ms: 300000,
    clock_anchor_at: null, result: null, winner_id: null, rated: false, created_at: new Date().toISOString(),
  };
  let viewer: "w" | "b" = "w";
  let status: "waiting" | "cancelled" | "active" = "waiting";
  let cancelRequests = 0;
  await page.route(`**/api/games/${id}`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ game: { ...waitingGame, status }, viewerColor: viewer }),
  }));
  await page.route(`**/api/games/${id}/cancel`, (route) => {
    cancelRequests++;
    if (viewer !== "w" || status !== "waiting") {
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Cannot cancel" }) });
    }
    status = "cancelled";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status }) });
  });
  await page.goto(`/game/${id}`);
  const cancel = page.getByRole("button", { name: "Cancel challenge" });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(page.getByText("Challenge cancelled", { exact: true })).toBeVisible();
  await expect(cancel).toHaveCount(0);
  expect(cancelRequests).toBe(1);
  await page.reload();
  await expect(page.getByText("Challenge cancelled", { exact: true })).toBeVisible();

  // The control is never offered to an opponent or during an active game.
  status = "waiting"; viewer = "b";
  await page.reload();
  await expect(page.getByText("Invite an opponent to begin.")).toBeVisible();
  await expect(cancel).toHaveCount(0);
  viewer = "w"; status = "active";
  await page.reload();
  await expect(page.getByText("Your turn", { exact: false }).first()).toBeVisible();
  await expect(cancel).toHaveCount(0);
  expect(cancelRequests).toBe(1);
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
