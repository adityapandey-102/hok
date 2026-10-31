import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Unit tests never touch a database or Supabase: services get in-memory
    // fakes. But importing a service still loads config/env.ts, which refuses
    // to start without these. Placeholder values (port 1: nothing listens)
    // make that work in CI, where there is no .env, and guarantee that a unit
    // test that accidentally reaches a real service fails fast instead of
    // quietly using the local stack. dotenv never overrides a set variable.
    env: {
      SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_SERVICE_ROLE_KEY: "unit-test-placeholder",
      SUPABASE_ANON_KEY: "unit-test-placeholder",
      DATABASE_URL: "postgres://unit:test@127.0.0.1:1/unit",
      LOG_LEVEL: "fatal",
    },
  },
});
