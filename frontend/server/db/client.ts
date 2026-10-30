import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client.ts";
import { getConfig } from "@/server/config/env.ts";

/**
 * Prisma client singleton. Prisma 7 uses a JavaScript driver adapter (pg) and
 * reads the connection string from prisma.config.ts for CLI commands and from
 * here at runtime. In tests TEST_DATABASE_URL (when set) takes precedence.
 */

const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
  __prismaUrl?: string;
};

export function resolveDatabaseUrl(): string {
  const { env } = getConfig();
  if (env.NODE_ENV === "test" && env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  return env.DATABASE_URL;
}

export function createPrismaClient(url = resolveDatabaseUrl()): PrismaClient {
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export function getPrisma(): PrismaClient {
  const url = resolveDatabaseUrl();
  if (!globalForPrisma.__prisma || globalForPrisma.__prismaUrl !== url) {
    globalForPrisma.__prisma = createPrismaClient(url);
    globalForPrisma.__prismaUrl = url;
  }
  return globalForPrisma.__prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.__prisma) {
    await globalForPrisma.__prisma.$disconnect();
    globalForPrisma.__prisma = undefined;
    globalForPrisma.__prismaUrl = undefined;
  }
}
