import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 keeps the connection string here instead of in schema.prisma.
// A fallback URL lets `prisma generate` run before .env exists.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI commands (migrate/generate/studio) use a DIRECT connection. On Supabase the
    // runtime DATABASE_URL is the pooled (pgbouncer) URL, which cannot run migrations;
    // set DIRECT_URL to the direct 5432 connection for `prisma migrate deploy`.
    // Locally, only DATABASE_URL is set and both resolve to it.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/real_estate_tool",
  },
});
