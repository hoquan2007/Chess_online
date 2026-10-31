import { expect, test } from "@playwright/test";

test("logged-out friend and online lobbies retain their own destination after authentication", async ({ page }) => {
  test.skip(process.env.ROOKLINE_E2E_MOCK_PUBLIC_AUTH !== "1", "Run with isolated public-only mock Supabase configuration.");

  for (const [route, next] of [["/play/friend", "%2Fplay%2Ffriend"], ["/play/online", "%2Fplay%2Fonline"]] as const) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Sign in to play" })).toBeVisible();
    const lobby = page.locator(".text-panel").filter({ has: page.getByRole("heading", { name: "Sign in to play" }) });
    await expect(lobby.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/login?next=${next}`);
    await expect(lobby.getByRole("link", { name: "Create account" })).toHaveAttribute("href", `/register?next=${next}`);
  }
});
