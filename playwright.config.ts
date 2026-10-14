import { defineConfig, devices } from "@playwright/test";

/**
 * E2E coverage for the critical workflows only (see CLAUDE.md's testing
 * pyramid) -- added milestone by milestone (login in M2, …). Not a full
 * click-every-page suite.
 *
 * Needs hok-api + HOK's local Supabase stack already running -- this config
 * only starts the Next.js dev server itself.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3400",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3400",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
