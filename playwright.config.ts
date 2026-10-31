import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { resolveStagingAppOrigin } from "./e2e/staging-target";

const stagingEnabled = process.env.ROOKLINE_STAGING_E2E === "1";
if (stagingEnabled) loadEnvConfig(process.cwd(), true);
const localPort = Number(process.env.ROOKLINE_E2E_PORT ?? "3100");
if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) throw new Error("Invalid ROOKLINE_E2E_PORT");
const appOrigin = stagingEnabled ? resolveStagingAppOrigin(process.env.ROOKLINE_STAGING_APP_ORIGIN) : `http://127.0.0.1:${localPort}`;
const externalStaging = stagingEnabled && process.env.ROOKLINE_STAGING_APP_ORIGIN !== undefined;
const productionServer = Boolean(process.env.CI) || process.env.ROOKLINE_E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./e2e",
  // Explicit hosted runs must never execute local-only mock scenarios against the public staging app.
  testMatch: externalStaging ? "**/staging-online.spec.ts" : "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome", baseURL: appOrigin, trace: "retain-on-failure" },
  webServer: externalStaging ? undefined : {
    // CI already built the standalone bundle; test its precompiled workers rather
    // than waiting for the dev server's on-demand compilation on first request.
    command: productionServer
      ? "node scripts/start-standalone-e2e.mjs"
      : `npm run dev -- --webpack --port ${localPort}`,
    env: productionServer ? { PORT: String(localPort), HOSTNAME: "127.0.0.1" } : undefined,
    url: appOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: "list",
  workers: 1,
});
