import { expect, test } from "@playwright/test";

for (const { pagePath, next } of [
  { pagePath: "/login", next: "/friends" },
  { pagePath: "/register", next: "/games" },
]) {
  test(`${pagePath} starts Google OAuth with a PKCE callback to the intended page`, async ({ page }) => {
    let authorizeUrl: URL | null = null;
    await page.route((url) => url.pathname === "/auth/v1/authorize", async (route) => {
      authorizeUrl = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body><h1>Mock Google provider</h1></body></html>",
      });
    });

    await page.goto(`${pagePath}?next=${encodeURIComponent(next)}`);
    if (await page.getByText("Online accounts are unavailable until Supabase environment variables are configured.").isVisible()) {
      test.skip(true, "Supabase browser URL/key are required to render the Google sign-in button.");
    }

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("heading", { name: "Mock Google provider" })).toBeVisible();
    expect(authorizeUrl).not.toBeNull();
    expect(authorizeUrl!.searchParams.get("provider")).toBe("google");
    const redirectTo = authorizeUrl!.searchParams.get("redirect_to");
    expect(redirectTo).toBeTruthy();
    const callback = new URL(redirectTo!);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("provider")).toBe("google");
    expect(callback.searchParams.get("next")).toBe(next);
    expect(callback.origin).toBe(new URL(test.info().project.use.baseURL!).origin);
  });
}

test("canceled Google consent shows an actionable message without leaking the provider error", async ({ page }) => {
  await page.goto("/auth/callback?provider=google&error=access_denied&next=%2Ffriends");
  await expect(page).toHaveURL(/\/login\?error=google&next=%2Ffriends$/);
  await expect(page.getByRole("alert").filter({ hasText: "Google sign-in" })).toContainText("Google sign-in was canceled or could not be completed");
});
