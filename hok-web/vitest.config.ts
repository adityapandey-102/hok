import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "modules/**/*.test.ts", "modules/**/*.test.tsx", "components/**/*.test.ts", "components/**/*.test.tsx"],
    environment: "node",
  },
});
