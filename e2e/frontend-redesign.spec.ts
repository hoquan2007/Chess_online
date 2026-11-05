import { expect, test } from "@playwright/test";

test("studio landing leads to modes and keeps working chess navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make every move count." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Play chess", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Let’s play chess." })).toBeVisible();
  await expect(page.locator(".grid-choices > a")).toHaveCount(4);
  await page.getByRole("link", { name: /Over the board/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Local chess" })).toBeVisible();
});

test("mobile dock exposes every route in More and closes on navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobile).toBeVisible();
  await expect(mobile.getByRole("link")).toHaveCount(4);
  await mobile.getByRole("button", { name: "More pages" }).click();
  const more = page.getByRole("dialog", { name: "More pages" });
  await expect(more).toBeVisible();
  await expect(more.getByRole("link", { name: "Settings" })).toBeVisible();
  await more.getByRole("link", { name: "Openings" }).click();
  await expect(more).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Know your first moves." })).toBeVisible();
  await mobile.getByRole("button", { name: "More pages" }).click();
  await expect(more).toBeVisible();
  await expect(more.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(more.getByRole("link", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).not.toBeVisible();
  await expect(mobile.getByRole("button", { name: "More pages" })).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("studio theme toggles while keeping readable controls", async ({ page }) => {
  await page.goto("/play");
  const theme = page.getByRole("button", { name: /Use (light|dark) theme/ });
  const originalLabel = await theme.getAttribute("aria-label");
  await theme.click();
  await expect(theme).not.toHaveAttribute("aria-label", originalLabel!);
  await expect(page.getByRole("link", { name: /Play the computer/ })).toBeVisible();
  await page.getByRole("link", { name: /Play the computer/ }).click();
  await expect(page.getByRole("heading", { name: "You versus the board." })).toBeVisible();
});
