import { withErrorHandling, parseBody, ok, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { getBuyerDetail, updateBuyer, deleteBuyer } from "@/server/services/records.ts";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const buyer = await getBuyerDetail(tenantId, id);
  return json({ success: true, buyer });
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const buyer = await updateBuyer(tenantId, id, body);
  return ok({ buyer });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  await deleteBuyer(tenantId, id);
  return ok({ id });
});
