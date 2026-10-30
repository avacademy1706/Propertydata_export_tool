import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { updateField, disableField } from "@/server/services/fields.ts";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const field = await updateField(tenantId, id, body);
  return ok({ field });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  await disableField(tenantId, id);
  return ok({ id, disabled: true });
});
