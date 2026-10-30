import { prisma } from "@/server/db/client.ts";

export const DEFAULT_TENANT_SLUG = "default";

let cachedDefaultTenantId: string | undefined;

/**
 * Returns the default tenant, creating it on first use. Every request is scoped
 * to a tenant id so that adding real multi-tenant auth later is a small change.
 */
export async function getDefaultTenantId(): Promise<string> {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: {},
    create: { slug: DEFAULT_TENANT_SLUG, name: "Default Agency" },
  });
  cachedDefaultTenantId = tenant.id;
  return tenant.id;
}

export function resetTenantCache(): void {
  cachedDefaultTenantId = undefined;
}

export interface TenantContext {
  tenantId: string;
  actor: string;
}

/** Resolve the tenant for an incoming API request. */
export async function getTenantContext(): Promise<TenantContext> {
  return { tenantId: await getDefaultTenantId(), actor: "dashboard-user" };
}
