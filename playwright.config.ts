import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { resolveStagingAppOrigin } from "./e2e/staging-target";

const stagingEnabled = process.env.ROOKLINE_STAGING_E2E === "1";
if (stagingEnabled) loadEnvConfig(process.cwd(), true);
const appOrigin = stagingEnabled ? resolveStagingAppOrigin(process.env.ROOKLINE_STAGING_APP_ORIGIN) : "http://127.0.0.1:3100";
const externalStaging = stagingEnabled && process.env.ROOKLINE_STAGING_APP_ORIGIN !== undefined;

export default defineConfig({
  testDir: "./e2e",
  // Explicit hosted runs must never execute local-only mock scenarios against the public staging app.
  testMatch: externalStaging ? "**/staging-online.spec.ts" : "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome", baseURL: appOrigin, trace: "retain-on-failure" },
  webServer: externalStaging ? undefined : {
    command: "npm run dev -- --webpack --port 3100",
    url: appOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: "list",
  workers: 1,
});
