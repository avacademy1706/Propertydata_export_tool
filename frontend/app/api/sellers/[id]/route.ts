import { withErrorHandling, parseBody, ok, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { getSellerDetail, updateSeller, deleteSeller } from "@/server/services/records.ts";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const seller = await getSellerDetail(tenantId, id);
  return json({ success: true, seller });
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const seller = await updateSeller(tenantId, id, body);
  return ok({ seller });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  await deleteSeller(tenantId, id);
  return ok({ id });
});
