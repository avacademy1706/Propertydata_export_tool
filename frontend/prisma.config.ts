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
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/real_estate_tool",
  },
});
