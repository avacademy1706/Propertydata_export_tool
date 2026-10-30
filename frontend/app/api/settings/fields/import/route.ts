import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { importFieldConfig } from "@/server/services/fields.ts";
import { z } from "zod";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (request: Request) => {
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const { tenantId } = await getTenantContext();
  const count = await importFieldConfig(tenantId, body);
  return ok({ imported: count });
});
