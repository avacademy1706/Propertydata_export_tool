import { z } from "zod";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { prisma } from "@/server/db/client.ts";
import { NotFoundError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  status: z.enum(["APPROVED", "PENDING", "BLOCKED"]).optional(),
  displayName: z.string().optional(),
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, BodySchema);
  const existing = await prisma.authorizedSender.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Sender not found.");
  const sender = await prisma.authorizedSender.update({ where: { id }, data: body });
  return ok({ sender: { id: sender.id, phone: sender.phoneE164, status: sender.status } });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const existing = await prisma.authorizedSender.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Sender not found.");
  await prisma.authorizedSender.delete({ where: { id } });
  return ok({ id, deleted: true });
});
