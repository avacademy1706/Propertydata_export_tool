import { beforeAll, afterAll } from "vitest";
import { config as loadEnv } from "dotenv";

// Integration tests require a PostgreSQL database. They run only when
// RUN_DB_TESTS=1 and a DATABASE_URL (or TEST_DATABASE_URL) is set, with the
// schema already applied (npm run db:deploy). Otherwise the test bodies below
// are skipped via `describe.skipIf(!dbEnabled)`.

loadEnv();

export const dbEnabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);

beforeAll(async () => {
  if (!dbEnabled) return;
  (process.env as Record<string, string>).NODE_ENV = "test";
});

afterAll(async () => {
  if (!dbEnabled) return;
  const { disconnectPrisma } = await import("@/server/db/client.ts");
  await disconnectPrisma();
});
