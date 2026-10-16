import { defineConfig, devices } from "@playwright/test";

/**
 * E2E coverage for the critical workflows only (see CLAUDE.md's testing
 * pyramid) -- added milestone by milestone (login in M2, …). Not a full
 * click-every-page suite.
 *
 * Needs hok-api + HOK's local Supabase stack already running -- this config
 * only starts the Next.js dev server itself.
 *
 * Parallel agents: `E2E_BASE_URL=http://localhost:3401 NEXT_DIST_DIR=.next-web`
 * reuses (or starts) a dev server on that port with its own build folder
 * (README "Parallel dev servers"). Add `--output=test-results-<agent>`.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3400";
const PORT = new URL(BASE_URL).port || "3400";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    // NEXT_DIST_DIR (if set) is inherited, so the server uses that build folder.
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
