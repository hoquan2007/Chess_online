import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome", baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --webpack --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: "list",
  workers: 1,
});
