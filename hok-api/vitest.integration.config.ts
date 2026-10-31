import { defineConfig } from "vitest/config";

// Integration tests hit a real Postgres instance (the local Supabase stack,
// `npx supabase start`) -- see tests/integration/README.md. Kept in a
// separate config/dir from unit tests so `npm run test:unit` never needs a
// database and stays fast enough to run on every save.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    // Same as CI's `.env` for this job. Every request's pino line otherwise
    // streams through the worker's IPC channel; on Windows that volume
    // occasionally ended a run with tinypool's "Channel closed"
    // (ERR_IPC_CHANNEL_CLOSED) after every test had passed. Errors still
    // print. dotenv never overrides a variable that is already set.
    env: { LOG_LEVEL: "error" },
  },
});
