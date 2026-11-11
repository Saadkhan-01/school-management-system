import { defineConfig } from "vitest/config";

/**
 * Phase 10 test config (§36).
 * - Integration tests boot the REAL Express app (src/app.ts) against a REAL
 *   MongoDB: an in-memory mongod started by tests/helpers/testDb.ts
 *   (mongodb-memory-server). No mocking of the app or the database.
 * - Files run sequentially (single fork) because every integration file shares
 *   one in-memory database lifecycle managed per-file; test timeouts are
 *   generous because mongod startup + bcrypt(12) are slow on shared CPUs.
 * - Environment (JWT secrets etc.) is set in tests/helpers/env.ts, which is a
 *   setupFile so it runs BEFORE src/config/env.ts is first imported.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/env.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
